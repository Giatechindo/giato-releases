import { COPY } from './js/i18n-dict.js';
import { renderIcons } from './js/icons.js';
import { escapeHtml, safeUrl } from './js/security.js';
import { setupTheme } from './js/theme.js';
import { setupFollowGate } from './js/follow-gate.js';

(function () {
  const html = document.documentElement;
  const langBtn = document.getElementById('lang-toggle');
  let currentLang = localStorage.getItem('giato-web-lang') || 'en';
  let currentTag = 'v0.1.0';
  let currentFeed = null;

  html.setAttribute('lang', currentLang);

  function detectOS() {
    const ua = (navigator.userAgent || '').toLowerCase();
    const plat = (navigator.platform || '').toLowerCase();
    if (ua.includes('mac') || plat.includes('mac')) return 'mac';
    if (ua.includes('win') || plat.includes('win')) return 'win';
    if (ua.includes('linux') || plat.includes('linux')) return 'linux';
    return 'mac';
  }

  const detectedOs = detectOS();

  function applyLanguage() {
    const dict = COPY[currentLang] || COPY.en;
    html.setAttribute('lang', currentLang);
    if (langBtn) langBtn.textContent = currentLang.toUpperCase();

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (typeof dict[key] === 'string') el.textContent = dict[key];
    });

    document.querySelectorAll('.os-card').forEach((card) => {
      const isDet = card.getAttribute('data-os') === detectedOs;
      card.classList.toggle('is-detected', isDet);
      const badge = card.querySelector('.os-badge');
      if (badge) badge.textContent = isDet ? dict.recommended : dict.desktop;
    });

    const primaryLabel = document.getElementById('hero-download-label');
    if (primaryLabel) {
      primaryLabel.textContent =
        detectedOs === 'win'
          ? dict.dlWinLabel(currentTag)
          : detectedOs === 'linux'
            ? dict.dlLinuxLabel(currentTag)
            : dict.dlMacLabel(currentTag);
    }

    if (window.GiatoOfficeSim && typeof window.GiatoOfficeSim.setLang === 'function') {
      window.GiatoOfficeSim.setLang(currentLang);
    }

    renderSliderCards();
    if (currentFeed) renderReleasesList(currentFeed);
  }

  if (langBtn) {
    langBtn.addEventListener('click', () => {
      currentLang = currentLang === 'en' ? 'id' : 'en';
      localStorage.setItem('giato-web-lang', currentLang);
      applyLanguage();
    });
  }

  function renderReleasesList(feed) {
    const dict = COPY[currentLang] || COPY.en;
    const ver = feed.version || '0.1.0';
    const tag = feed.tag || `v${ver}`;
    const fallbackUrl = feed.releaseUrl || `https://github.com/Giatechindo/giato-releases/releases/tag/${tag}`;
    const listEl = document.getElementById('release-list');
    const history = Array.isArray(feed.history) && feed.history.length > 0 ? feed.history : [feed];

    if (listEl) {
      listEl.innerHTML = history
        .map(
          (item) => `
          <article class="release-row">
            <div class="release-ver">
              <strong>v${escapeHtml(item.version || ver)}</strong>
              <span>${escapeHtml(item.date || '')}</span>
            </div>
            <p class="release-notes">${escapeHtml(item.notes || '')}</p>
            <a class="btn" href="${escapeHtml(safeUrl(item.releaseUrl || fallbackUrl, fallbackUrl))}" target="_blank" rel="noopener noreferrer">
              <i data-lucide="arrow-up-right"></i>
              <span>${dict.openRelease}</span>
            </a>
          </article>
        `
        )
        .join('');
      renderIcons();
    }
  }

  async function hydrateReleases() {
    let feed = null;
    try {
      const res = await fetch('./update.json', { cache: 'no-store' });
      if (res.ok) feed = await res.json();
    } catch {
      // Keep defaults
    }
    if (!feed) return;
    currentFeed = feed;

    const ver = feed.version || '0.1.0';
    currentTag = feed.tag || `v${ver}`;
    const dl = feed.downloads || {};
    const fallbackUrl = feed.releaseUrl || `https://github.com/Giatechindo/giato-releases/releases/tag/${currentTag}`;

    document.querySelectorAll('[data-version-badge]').forEach((el) => {
      el.textContent = currentTag;
    });

    const primaryBtn = document.getElementById('hero-primary-download');
    if (primaryBtn) {
      const urlMap = {
        mac: dl.mac_arm64_dmg || fallbackUrl,
        win: dl.win_x64_exe || fallbackUrl,
        linux: dl.linux_x64_appimage || fallbackUrl
      };
      primaryBtn.href = safeUrl(urlMap[detectedOs] || fallbackUrl, fallbackUrl);
    }

    const linkMap = {
      'dl-mac-dmg': dl.mac_arm64_dmg,
      'dl-win-exe': dl.win_x64_exe,
      'dl-win-msi': dl.win_x64_msi,
      'dl-linux-appimage': dl.linux_x64_appimage,
      'dl-linux-deb': dl.linux_x64_deb
    };
    Object.entries(linkMap).forEach(([id, url]) => {
      const el = document.getElementById(id);
      if (el && url) el.href = safeUrl(url, el.href);
    });

    const noticeBar = document.getElementById('notice-bar');
    const firstNotice = Array.isArray(feed.announcements) ? feed.announcements[0] : null;
    if (noticeBar && firstNotice && firstNotice.title) {
      document.getElementById('notice-text').textContent = firstNotice.title;
      const nLink = document.getElementById('notice-link');
      if (nLink) nLink.href = firstNotice.url ? safeUrl(firstNotice.url, '#downloads') : '#downloads';
      noticeBar.hidden = false;
    }

    applyLanguage();
  }

  function setupOfficeOverlay() {
    const sim = window.GiatoOfficeSim;
    if (!sim) return;

    const agents = sim.getAgents();
    const dockAgents = document.getElementById('dock-agents');
    const liveName = document.getElementById('live-agent-name');
    const liveTask = document.getElementById('live-agent-task');
    const liveDot = document.getElementById('live-agent-dot');

    function renderDockAgents(selectedId) {
      if (!dockAgents) return;
      dockAgents.innerHTML = agents
        .map(
          (a) => `
          <button type="button" class="dock-btn ${a.id === selectedId ? 'is-selected' : ''}" data-agent-id="${escapeHtml(a.id)}">
            <span class="agent-dot" style="background:${escapeHtml(a.color)}"></span>
            <span>${escapeHtml(a.name)}</span>
          </button>
        `
        )
        .join('');
      dockAgents.querySelectorAll('[data-agent-id]').forEach((btn) => {
        btn.addEventListener('click', () => sim.selectAgent(btn.getAttribute('data-agent-id')));
      });
    }

    function updateLivePill(agent) {
      if (!agent) return;
      renderDockAgents(agent.id);
      if (liveName) liveName.textContent = agent.name;
      if (liveTask) liveTask.textContent = agent.task;
      if (liveDot) liveDot.style.background = agent.color;
    }

    window.addEventListener('giato:agent-selected', (e) => updateLivePill(e.detail));
    window.addEventListener('giato:agent-updated', (e) => updateLivePill(e.detail));

    setInterval(() => {
      const active = agents.find((a) => a.id === sim.getSelectedId());
      if (active && liveTask) liveTask.textContent = active.task;
    }, 450);

    document.querySelectorAll('[data-scenario]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sc = btn.getAttribute('data-scenario');
        document.querySelectorAll('[data-scenario]').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        sim.runScenario(sc);
        const active = agents.find((a) => a.id === sim.getSelectedId());
        if (active) updateLivePill(active);
      });
    });

    document.getElementById('sim-rot-left')?.addEventListener('click', () => sim.rotateBy(-45));
    document.getElementById('sim-rot-right')?.addEventListener('click', () => sim.rotateBy(45));
    document.getElementById('sim-zoom-in')?.addEventListener('click', () => sim.zoomBy(1.18));
    document.getElementById('sim-zoom-out')?.addEventListener('click', () => sim.zoomBy(0.84));
    document.getElementById('sim-reset')?.addEventListener('click', () => sim.resetView());

    const pauseBtn = document.getElementById('sim-pause');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        const isPaused = sim.togglePause();
        pauseBtn.innerHTML = `<i data-lucide="${isPaused ? 'play' : 'pause'}"></i>`;
        renderIcons();
      });
    }

    updateLivePill(agents[0]);
  }

  let velocityBoost = 0;
  let sliderStarted = false;

  function renderSliderCards() {
    const trackLeft = document.getElementById('slider-track-left');
    const trackRight = document.getElementById('slider-track-right');
    if (!trackLeft || !trackRight) return;

    const dict = COPY[currentLang] || COPY.en;
    const makeCards = (items) =>
      [...items, ...items]
        .map(
          (item) => `
          <div class="slide-card" data-jump-scenario="${escapeHtml(item.scenario)}">
            <div class="slide-icon"><i data-lucide="${escapeHtml(item.icon)}"></i></div>
            <div>
              <span class="slide-title">${escapeHtml(item.title)}</span>
              <span class="slide-sub">${escapeHtml(item.sub)}</span>
            </div>
          </div>
        `
        )
        .join('');

    trackLeft.innerHTML = makeCards(dict.row1);
    trackRight.innerHTML = makeCards(dict.row2);
    renderIcons();

    document.querySelectorAll('[data-jump-scenario]').forEach((card) => {
      card.addEventListener('click', () => {
        const sc = card.getAttribute('data-jump-scenario');
        const btn = document.querySelector(`[data-scenario="${sc}"]`);
        if (btn) btn.click();
        document.getElementById('office')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
  }

  function setupKineticSlider() {
    if (sliderStarted) return;
    sliderStarted = true;
    const trackLeft = document.getElementById('slider-track-left');
    const trackRight = document.getElementById('slider-track-right');
    const band = document.getElementById('slider-band');
    if (!trackLeft || !trackRight) return;

    renderSliderCards();

    let offsetA = 0;
    let offsetB = 0;
    let hoverPaused = false;
    let lastTs = performance.now();

    function step(ts) {
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;

      const halfA = trackLeft.scrollWidth * 0.5 || 1;
      const halfB = trackRight.scrollWidth * 0.5 || 1;

      if (!hoverPaused || Math.abs(velocityBoost) > 1) {
        const baseSpeed = hoverPaused ? 0 : 42;
        offsetA += (baseSpeed + velocityBoost) * dt;
        offsetB -= (baseSpeed * 0.85 - velocityBoost) * dt;
        velocityBoost *= Math.pow(0.08, dt);

        offsetA = ((offsetA % halfA) + halfA) % halfA;
        offsetB = ((offsetB % halfB) + halfB) % halfB;

        trackLeft.style.transform = `translate3d(${-offsetA}px, 0, 0)`;
        trackRight.style.transform = `translate3d(${-offsetB}px, 0, 0)`;
      }
      requestAnimationFrame(step);
    }

    requestAnimationFrame(step);

    if (band) {
      band.addEventListener('mouseenter', () => { hoverPaused = true; });
      band.addEventListener('mouseleave', () => { hoverPaused = false; });
    }

    document.getElementById('slider-prev')?.addEventListener('click', () => { velocityBoost = -540; });
    document.getElementById('slider-next')?.addEventListener('click', () => { velocityBoost = 540; });
  }

  setupTheme();
  renderIcons();
  setupOfficeOverlay();
  setupKineticSlider();
  setupFollowGate(() => currentLang);
  applyLanguage();
  hydrateReleases();
})();
