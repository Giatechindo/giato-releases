import { COPY } from './i18n-dict.js';
import { renderIcons } from './icons.js';
import { safeUrl } from './security.js';

const FOLLOW_KEY = 'giato-web-followed-v1';
const DOWNLOAD_TRIGGER_IDS = ['hero-primary-download', 'dl-mac-dmg', 'dl-win-exe', 'dl-win-msi', 'dl-linux-appimage', 'dl-linux-deb'];

/** Shows a modal asking the visitor to open the project's four channels before their first real download.
 * Honest about what it can check: a static site can only tell that a link was opened in a new tab, never
 * that someone actually followed -- the copy and the continue button's label say exactly that.
 * `getLang` is called fresh each time so this stays in sync with the page's own language toggle. */
export function setupFollowGate(getLang) {
  const overlay = document.getElementById('follow-gate');
  const continueBtn = document.getElementById('follow-gate-continue');
  const closeBtn = document.getElementById('follow-gate-close');
  if (!overlay || !continueBtn) return;

  const socialLinks = Array.from(overlay.querySelectorAll('.social-link'));
  let pendingUrl = null;
  let pendingTarget = null;

  function updateContinueLabel() {
    const dict = COPY[getLang()] || COPY.en;
    const visited = socialLinks.filter((a) => a.classList.contains('is-visited')).length;
    const ready = visited >= socialLinks.length;
    continueBtn.disabled = !ready;
    continueBtn.querySelector('span').textContent = ready ? dict.gateContinueReady : dict.gateContinueLocked(visited);
  }

  function openGate(url, target) {
    pendingUrl = url;
    pendingTarget = target;
    overlay.hidden = false;
    renderIcons();
    updateContinueLabel();
  }

  function closeGate() {
    overlay.hidden = true;
    pendingUrl = null;
    pendingTarget = null;
  }

  function followedAlready() {
    try { return localStorage.getItem(FOLLOW_KEY) === '1'; } catch { return false; }
  }

  function markFollowed() {
    try { localStorage.setItem(FOLLOW_KEY, '1'); } catch {
      // Private browsing or storage disabled: the gate just reopens next time, which is fine.
    }
  }

  DOWNLOAD_TRIGGER_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', (event) => {
      if (followedAlready()) return;
      event.preventDefault();
      openGate(el.href, el.target || '_self');
    });
  });

  socialLinks.forEach((link) => {
    link.addEventListener('click', () => {
      link.classList.add('is-visited');
      updateContinueLabel();
    });
  });

  continueBtn.addEventListener('click', () => {
    if (continueBtn.disabled) return;
    markFollowed();
    const url = pendingUrl ? safeUrl(pendingUrl) : null;
    const target = pendingTarget;
    closeGate();
    if (url && url !== '#') {
      if (target === '_blank') window.open(url, '_blank', 'noopener');
      else window.location.href = url;
    }
  });

  closeBtn?.addEventListener('click', closeGate);
  overlay.addEventListener('click', (event) => { if (event.target === overlay) closeGate(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !overlay.hidden) closeGate(); });
}
