(function () {
  const html = document.documentElement;
  const themeBtn = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('giato-web-theme') || 'dark';
  html.setAttribute('data-theme', savedTheme);

  function renderIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function syncThemeIcon() {
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
      syncThemeIcon();
    });
  }

  function detectOS() {
    const ua = (navigator.userAgent || '').toLowerCase();
    const plat = (navigator.platform || '').toLowerCase();
    if (ua.includes('mac') || plat.includes('mac')) return 'mac';
    if (ua.includes('win') || plat.includes('win')) return 'win';
    if (ua.includes('linux') || plat.includes('linux')) return 'linux';
    return 'mac';
  }

  const detectedOs = detectOS();
  document.querySelectorAll('.os-card').forEach((card) => {
    if (card.getAttribute('data-os') === detectedOs) {
      card.classList.add('is-detected');
      const badge = card.querySelector('.os-badge');
      if (badge) badge.textContent = 'Rekomendasi';
    }
  });

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function hydrateReleases() {
    let feed = null;
    try {
      const res = await fetch('./update.json', { cache: 'no-store' });
      if (res.ok) feed = await res.json();
    } catch {
      // Keep default links
    }
    if (!feed) return;

    const ver = feed.version || '0.1.0';
    const tag = feed.tag || `v${ver}`;
    const dl = feed.downloads || {};
    const fallbackUrl = feed.releaseUrl || `https://github.com/Giatechindo/giato-releases/releases/tag/${tag}`;

    document.querySelectorAll('[data-version-badge]').forEach((el) => {
      el.textContent = tag;
    });

    const primaryBtn = document.getElementById('hero-primary-download');
    const primaryLabel = document.getElementById('hero-download-label');
    if (primaryBtn && primaryLabel) {
      const map = {
        mac: { label: `Unduh untuk macOS (${tag})`, url: dl.mac_arm64_dmg || fallbackUrl },
        win: { label: `Unduh untuk Windows (${tag})`, url: dl.win_x64_exe || fallbackUrl },
        linux: { label: `Unduh untuk Linux (${tag})`, url: dl.linux_x64_appimage || fallbackUrl }
      };
      const chosen = map[detectedOs] || map.mac;
      primaryLabel.textContent = chosen.label;
      primaryBtn.href = chosen.url;
    }

    const linkMap = {
      'dl-mac-dmg': dl.mac_arm64_dmg,
      'dl-win-exe': dl.win_x64_exe,
      'dl-win-msi': dl.win_x64_msi,
      'dl-linux-appimage': dl.linux_x64_appimage,
      'dl-linux-deb': dl.linux_x64_deb,
      'dl-checksums': dl.checksums
    };
    Object.entries(linkMap).forEach(([id, url]) => {
      const el = document.getElementById(id);
      if (el && url) el.href = url;
    });

    const noticeBar = document.getElementById('notice-bar');
    const firstNotice = Array.isArray(feed.announcements) ? feed.announcements[0] : null;
    if (noticeBar && firstNotice && firstNotice.title) {
      document.getElementById('notice-text').textContent = firstNotice.title;
      const nLink = document.getElementById('notice-link');
      if (nLink) nLink.href = firstNotice.url || '#downloads';
      noticeBar.hidden = false;
    }

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
            <a class="btn" href="${escapeHtml(item.releaseUrl || fallbackUrl)}" target="_blank" rel="noopener">
              <i data-lucide="arrow-up-right"></i>
              <span>Rilis</span>
            </a>
          </article>
        `
        )
        .join('');
      renderIcons();
    }
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
          <button type="button" class="dock-btn ${a.id === selectedId ? 'is-selected' : ''}" data-agent-id="${a.id}">
            <span class="agent-dot" style="background:${a.color}"></span>
            <span>${a.name}</span>
          </button>
        `
        )
        .join('');
      dockAgents.querySelectorAll('[data-agent-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          sim.selectAgent(btn.getAttribute('data-agent-id'));
        });
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
    }, 500);

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

    const pauseBtn = document.getElementById('sim-pause');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        const isPaused = sim.togglePause();
        pauseBtn.innerHTML = `<i data-lucide="${isPaused ? 'play' : 'pause'}"></i>`;
        pauseBtn.setAttribute('aria-label', isPaused ? 'Lanjutkan simulasi' : 'Jeda simulasi');
        renderIcons();
      });
    }

    const resetBtn = document.getElementById('sim-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => sim.resetView());
    }

    updateLivePill(agents[0]);
  }

  syncThemeIcon();
  renderIcons();
  hydrateReleases();
  setupOfficeOverlay();
})();
