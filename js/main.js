/**
 * FillQR - Main JavaScript
 * Mobile Menu, Smooth Scroll, Contact Form with Anti-Bot Protection
 * v2.0 - Februar 2026
 */

document.addEventListener('DOMContentLoaded', function() {
    initMobileMenu();
    initSmoothScroll();
    initContactForm();
    initCaptcha();
    initCopyButton();
    initScrollToForm();
});

/**
 * Mobile Menu Toggle
 */
function initMobileMenu() {
    const menuBtn = document.querySelector('.header__menu-btn');
    const nav = document.querySelector('.header__nav');

    if (!menuBtn || !nav) return;

    menuBtn.addEventListener('click', function() {
        const isOpen = menuBtn.getAttribute('aria-expanded') === 'true';
        menuBtn.setAttribute('aria-expanded', !isOpen);
        nav.classList.toggle('is-open');
        document.body.style.overflow = isOpen ? '' : 'hidden';
    });

    // Close menu when clicking a link
    nav.querySelectorAll('.header__nav-link').forEach(function(link) {
        link.addEventListener('click', function() {
            menuBtn.setAttribute('aria-expanded', 'false');
            nav.classList.remove('is-open');
            document.body.style.overflow = '';
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
        if (!nav.contains(e.target) && !menuBtn.contains(e.target) && nav.classList.contains('is-open')) {
            menuBtn.setAttribute('aria-expanded', 'false');
            nav.classList.remove('is-open');
            document.body.style.overflow = '';
        }
    });
}

/**
 * Smooth Scroll for Anchor Links
 */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const target = document.querySelector(targetId);
            if (!target) return;

            e.preventDefault();

            const headerHeight = document.querySelector('.header').offsetHeight;
            const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight - 20;

            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        });
    });
}

/**
 * Simple Captcha Generator
 */
let captchaAnswer = null;

function initCaptcha() {
    const questionEl = document.getElementById('captcha-question');
    if (!questionEl) return;

    // Generate simple math question
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    captchaAnswer = a + b;
    questionEl.textContent = a + ' + ' + b;
}

/**
 * Contact Form Handler with Anti-Bot Protection
 * Sends data to PHP proxy which forwards to n8n webhook
 */
const CONTACT_API = '/api/contact.php';

function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    // Track form load time (bots submit too fast)
    const formLoadTime = Date.now();

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Anti-Bot Check 1: Honeypot field should be empty
        const honeypot = form.querySelector('input[name="website"]');
        if (honeypot && honeypot.value) {
            console.log('Bot detected: Honeypot filled');
            showMessage('Es gab ein Problem. Bitte versuchen Sie es erneut.', 'error');
            return;
        }

        // Anti-Bot Check 2: Form submitted too fast (< 3 seconds)
        const timeSpent = Date.now() - formLoadTime;
        if (timeSpent < 3000) {
            console.log('Bot detected: Too fast submission');
            showMessage('Bitte nehmen Sie sich einen Moment Zeit zum Ausfuellen.', 'error');
            return;
        }

        // Anti-Bot Check 3: Captcha
        const captchaInput = form.querySelector('#captcha');
        if (captchaInput && parseInt(captchaInput.value) !== captchaAnswer) {
            showMessage('Die Rechenaufgabe wurde nicht korrekt geloest. Bitte versuchen Sie es erneut.', 'error');
            initCaptcha(); // Generate new question
            captchaInput.value = '';
            captchaInput.focus();
            return;
        }

        // Get form data
        const verein = form.querySelector('#verein')?.value.trim() || '';
        const name = form.querySelector('#name')?.value.trim() || '';
        const email = form.querySelector('#email')?.value.trim() || '';
        const message = form.querySelector('#message')?.value.trim() || '';
        const topic = form.querySelector('input[name="topic"]:checked')?.value || 'Interesse an FillQR';
        const privacy = form.querySelector('#privacy')?.checked || false;

        // Validation
        if (!verein || !name || !email) {
            showMessage('Bitte alle Pflichtfelder ausfuellen.', 'error');
            return;
        }

        if (!privacy) {
            showMessage('Bitte stimmen Sie der Datenschutzerklaerung zu.', 'error');
            return;
        }

        // Disable submit button and show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Wird gesendet...';

        try {
            // Send to PHP proxy (which forwards to n8n)
            const response = await fetch(CONTACT_API, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    verein: verein,
                    name: name,
                    email: email,
                    message: message,
                    topic: topic,
                    privacy: privacy
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // Success
                showMessage('Vielen Dank! Ihre Anfrage wurde gesendet. Sie erhalten in Kuerze eine Bestaetigungsmail.', 'success');
                form.reset();
                initCaptcha(); // Reset captcha
            } else {
                // Server returned error
                showMessage(result.message || 'Es gab ein Problem. Bitte versuchen Sie es erneut oder schreiben Sie uns direkt an info@erp-buddy.de', 'error');
            }
        } catch (error) {
            // Network error
            console.error('Form submission error:', error);
            showMessage('Verbindungsfehler. Bitte versuchen Sie es erneut oder schreiben Sie uns direkt an info@erp-buddy.de', 'error');
        } finally {
            // Re-enable submit button
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    });
}

/**
 * Copy Email Button - CSP-konform via Event Listener
 */
function initCopyButton() {
    const copyBtn = document.getElementById('copy-email-btn');
    if (!copyBtn) return;

    copyBtn.addEventListener('click', function() {
        const email = 'info@erp-buddy.de';

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(email).then(function() {
                showCopyFeedback(true);
            }).catch(function() {
                fallbackCopy(email);
            });
        } else {
            fallbackCopy(email);
        }
    });
}

/**
 * Scroll to Contact Form Button
 */
function initScrollToForm() {
    const scrollBtn = document.getElementById('scroll-to-form-btn');
    if (!scrollBtn) return;

    scrollBtn.addEventListener('click', function() {
        const form = document.getElementById('contact-form');
        if (!form) return;

        const headerHeight = document.querySelector('.header').offsetHeight;
        const targetPosition = form.getBoundingClientRect().top + window.pageYOffset - headerHeight - 20;

        window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });
    });
}

function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
        document.execCommand('copy');
        showCopyFeedback(true);
    } catch (err) {
        showCopyFeedback(false);
    }

    document.body.removeChild(textarea);
}

function showCopyFeedback(success) {
    const btn = document.querySelector('.contact-option .btn--secondary');
    if (!btn) return;

    const originalText = btn.textContent;
    btn.textContent = success ? 'Kopiert!' : 'Fehler - manuell kopieren';
    btn.style.background = success ? 'var(--color-green)' : '#dc3545';
    btn.style.borderColor = success ? 'var(--color-green)' : '#dc3545';
    btn.style.color = '#fff';

    setTimeout(function() {
        btn.textContent = originalText;
        btn.style.background = '';
        btn.style.borderColor = '';
        btn.style.color = '';
    }, 2000);
}

/**
 * Show message to user
 */
function showMessage(text, type) {
    // Remove existing message
    const existing = document.querySelector('.contact__message');
    if (existing) existing.remove();

    // Create message element
    const msg = document.createElement('div');
    msg.className = 'contact__message contact__message--' + type;
    msg.textContent = text;

    // Insert after form
    const form = document.getElementById('contact-form');
    if (form) {
        form.insertAdjacentElement('afterend', msg);

        // Auto-remove after 10 seconds
        setTimeout(function() {
            msg.remove();
        }, 10000);
    } else {
        alert(text);
    }
}
