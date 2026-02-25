/**
 * FillQR Theme Toggle (Light/Dark)
 * Include at bottom of <body>, after the toggle button HTML.
 */
(function () {
  var body = document.body;
  var toggle = document.getElementById('theme-toggle');
  if (!toggle) return;

  var label = toggle.querySelector('.theme-toggle__label');
  var isLight = body.classList.contains('theme-light');

  // Set initial toggle state (body class was already applied by inline head script)
  if (isLight) {
    toggle.classList.add('theme-toggle--light');
    if (label) label.textContent = 'Hell';
  } else {
    if (label) label.textContent = 'Dunkel';
  }

  toggle.addEventListener('click', function () {
    var next = body.classList.contains('theme-light') ? 'dark' : 'light';
    if (next === 'light') {
      body.classList.add('theme-light');
      toggle.classList.add('theme-toggle--light');
      if (label) label.textContent = 'Hell';
    } else {
      body.classList.remove('theme-light');
      toggle.classList.remove('theme-toggle--light');
      if (label) label.textContent = 'Dunkel';
    }
    try { localStorage.setItem('fillqr-theme', next); } catch (e) {}
  });
})();
