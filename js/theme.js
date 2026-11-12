import { renderIcons } from './icons.js';

/** Light/dark toggle, remembered in localStorage. Self-contained: queries its own elements, owns its
 * own storage key, needs nothing passed in. */
export function setupTheme() {
  const html = document.documentElement;
  const themeBtn = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('giato-web-theme') || 'dark';
  html.setAttribute('data-theme', savedTheme);

  function syncIcon() {
    if (!themeBtn) return;
    const isLight = html.getAttribute('data-theme') === 'light';
    themeBtn.innerHTML = `<i data-lucide="${isLight ? 'moon' : 'sun'}"></i>`;
    renderIcons();
  }

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      html.setAttribute('data-theme', next);
      localStorage.setItem('giato-web-theme', next);
      syncIcon();
    });
  }

  syncIcon();
}
