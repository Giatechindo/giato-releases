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
      // Keep defaults
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
        mac: { label: `Unduh macOS (${tag})`, url: dl.mac_arm64_dmg || fallbackUrl },
        win: { label: `Unduh Windows (${tag})`, url: dl.win_x64_exe || fallbackUrl },
        linux: { label: `Unduh Linux (${tag})`, url: dl.linux_x64_appimage || fallbackUrl }
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
      'dl-linux-deb': dl.linux_x64_deb
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
              <span>Buka</span>
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

  // Interactive Left-Right Dual-Track Slider
  function setupKineticSlider() {
    const trackLeft = document.getElementById('slider-track-left');
    const trackRight = document.getElementById('slider-track-right');
    const prevBtn = document.getElementById('slider-prev');
    const nextBtn = document.getElementById('slider-next');
    const band = document.getElementById('slider-band');
    if (!trackLeft || !trackRight) return;

    const row1 = [
      { icon: 'users', title: 'Tim Agent Paralel', sub: 'Bagi tugas otomatis', scenario: 'swarm' },
      { icon: 'terminal', title: 'Server SSH', sub: 'Terminal multi-host', scenario: 'ssh' },
      { icon: 'code-2', title: 'Editor & Diff', sub: 'Pantau tiap perubahan', scenario: 'swarm' },
      { icon: 'globe', title: 'Browser Bawaan', sub: 'Pratinjau langsung', scenario: 'release' },
      { icon: 'folder-git-2', title: 'Lintas Proyek', sub: 'Banyak folder rapi', scenario: 'swarm' }
    ];

    const row2 = [
      { icon: 'hard-drive', title: 'Data Lokal', sub: 'Simpan cepat di komputer', scenario: 'db' },
      { icon: 'database', title: 'Sync PostgreSQL', sub: 'Opsional 2 arah', scenario: 'db' },
      { icon: 'bell', title: 'Update Otomatis', sub: 'Notif rilis terbaru', scenario: 'release' },
      { icon: 'laptop', title: 'Multi-OS', sub: 'Mac, Windows, Linux', scenario: 'release' },
      { icon: 'shield', title: 'Login GitHub', sub: 'Data tetap pribadi', scenario: 'swarm' }
    ];

    const makeCards = (items) =>
      [...items, ...items]
        .map(
          (item) => `
          <div class="slide-card" data-jump-scenario="${item.scenario}">
            <div class="slide-icon"><i data-lucide="${item.icon}"></i></div>
            <div>
              <span class="slide-title">${item.title}</span>
              <span class="slide-sub">${item.sub}</span>
            </div>
          </div>
        `
        )
        .join('');

    trackLeft.innerHTML = makeCards(row1);
    trackRight.innerHTML = makeCards(row2);
    renderIcons();

    let offsetA = 0;
    let offsetB = 0;
    let velocityBoost = 0;
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

    if (prevBtn) {
      prevBtn.addEventListener('click', () => { velocityBoost = -520; });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => { velocityBoost = 520; });
    }

    band?.querySelectorAll('[data-jump-scenario]').forEach((card) => {
      card.addEventListener('click', () => {
        const sc = card.getAttribute('data-jump-scenario');
        const btn = document.querySelector(`[data-scenario="${sc}"]`);
        if (btn) btn.click();
        document.getElementById('office')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
  }

  syncThemeIcon();
  renderIcons();
  hydrateReleases();
  setupOfficeOverlay();
  setupKineticSlider();
})();
