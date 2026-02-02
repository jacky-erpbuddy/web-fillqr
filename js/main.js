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
 */
function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    // Track form load time (bots submit too fast)
    const formLoadTime = Date.now();

    form.addEventListener('submit', function(e) {
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
            showMessage('Bitte nehmen Sie sich einen Moment Zeit zum Ausfüllen.', 'error');
            return;
        }

        // Anti-Bot Check 3: Captcha
        const captchaInput = form.querySelector('#captcha');
        if (captchaInput && parseInt(captchaInput.value) !== captchaAnswer) {
            showMessage('Die Rechenaufgabe wurde nicht korrekt gelöst. Bitte versuchen Sie es erneut.', 'error');
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

        // Validation
        if (!verein || !name || !email) {
            showMessage('Bitte alle Pflichtfelder ausfüllen.', 'error');
            return;
        }

        // Create mailto link
        const subject = encodeURIComponent('[FillQR] ' + topic + ' - ' + verein);
        const body = encodeURIComponent(
            'Verein: ' + verein + '\n' +
            'Ansprechpartner: ' + name + '\n' +
            'E-Mail: ' + email + '\n' +
            'Thema: ' + topic + '\n\n' +
            'Nachricht:\n' + (message || '(keine Nachricht)')
        );

        // Create and click mailto link
        const mailtoLink = document.createElement('a');
        mailtoLink.href = 'mailto:info@erp-buddy.de?subject=' + subject + '&body=' + body;
        mailtoLink.style.display = 'none';
        document.body.appendChild(mailtoLink);
        mailtoLink.click();
        document.body.removeChild(mailtoLink);

        // Show confirmation
        showMessage('Vielen Dank! Ihr E-Mail-Programm sollte sich jetzt öffnen. Falls nicht, schreiben Sie uns direkt an info@erp-buddy.de', 'success');
    });
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
