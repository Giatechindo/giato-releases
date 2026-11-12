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

  // OS detection for hero CTA + highlighting download card
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
      if (badge) badge.textContent = 'Terdeteksi';
    }
  });

  // Load feed from update.json (and check GitHub Releases fallback)
  async function hydrateReleases() {
    let feed = null;
    try {
      const res = await fetch('./update.json', { cache: 'no-store' });
      if (res.ok) feed = await res.json();
    } catch {
      // Fallback handled below
    }

    if (!feed) return;
    const ver = feed.version || '0.1.0';
    const tag = feed.tag || `v${ver}`;
    const dl = feed.downloads || {};
    const fallbackUrl = feed.releaseUrl || `https://github.com/Giatechindo/giato-releases/releases/tag/${tag}`;

    document.querySelectorAll('[data-version-badge]').forEach((el) => {
      el.textContent = tag;
    });

    // Wire primary OS download button
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

    // Wire platform download matrix links
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

    // Announcement ribbon
    const noticeBar = document.getElementById('notice-bar');
    const firstNotice = Array.isArray(feed.announcements) ? feed.announcements[0] : null;
    if (noticeBar && firstNotice && firstNotice.title) {
      document.getElementById('notice-text').textContent = `${firstNotice.title} — ${firstNotice.body || ''}`;
      const nLink = document.getElementById('notice-link');
      if (nLink) nLink.href = firstNotice.url || '#downloads';
      noticeBar.hidden = false;
    }

    // Release history list
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
              <i data-lucide="external-link"></i>
              <span>Assets</span>
            </a>
          </article>
        `
        )
        .join('');
      renderIcons();
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Wire Virtual AI Office Inspector UI
  function setupOfficeInspector() {
    const sim = window.GiatoOfficeSim;
    if (!sim) return;

    const tabsEl = document.getElementById('agent-tabs');
    const agents = sim.getAgents();

    function renderAgentTabs(selectedId) {
      if (!tabsEl) return;
      tabsEl.innerHTML = agents
        .map(
          (a) => `
          <button type="button" class="agent-chip ${a.id === selectedId ? 'is-selected' : ''}" data-agent-id="${a.id}">
            <span class="agent-dot" style="background:${a.color}"></span>
            <span>${a.name}</span>
          </button>
        `
        )
        .join('');
      tabsEl.querySelectorAll('[data-agent-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          sim.selectAgent(btn.getAttribute('data-agent-id'));
        });
      });
    }

    function updateInspector(agent) {
      if (!agent) return;
      renderAgentTabs(agent.id);
      document.getElementById('ins-name').textContent = agent.name;
      document.getElementById('ins-role').textContent = `${agent.role} · ${agent.model}`;
      document.getElementById('ins-state').textContent = agent.state;
      document.getElementById('ins-zone').textContent = agent.zone.toUpperCase();
      document.getElementById('ins-task').textContent = agent.task;
      const logBox = document.getElementById('ins-log');
      if (logBox) {
        logBox.innerHTML = agent.logs
          .map((line) => `<div class="log-line"><span>${escapeHtml(line)}</span></div>`)
          .join('');
      }
    }

    window.addEventListener('giato:agent-selected', (e) => updateInspector(e.detail));
    window.addEventListener('giato:agent-updated', (e) => updateInspector(e.detail));

    // Periodic refresh of active agent's current task/zone while walking
    setInterval(() => {
      const current = agents.find((a) => a.id === sim.getSelectedId());
      if (current) {
        document.getElementById('ins-state').textContent = current.state;
        document.getElementById('ins-zone').textContent = current.zone.toUpperCase();
        document.getElementById('ins-task').textContent = current.task;
      }
    }, 500);

    // Scenario toolbar buttons
    document.querySelectorAll('[data-scenario]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sc = btn.getAttribute('data-scenario');
        document.querySelectorAll('[data-scenario]').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        sim.runScenario(sc);
      });
    });

    const pauseBtn = document.getElementById('sim-pause');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        const isPaused = sim.togglePause();
        pauseBtn.innerHTML = `<i data-lucide="${isPaused ? 'play' : 'pause'}"></i><span>${isPaused ? 'Resume' : 'Pause'}</span>`;
        renderIcons();
      });
    }

    const resetBtn = document.getElementById('sim-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => sim.resetView());
    }

    // Quick task dispatch buttons for currently selected agent
    document.querySelectorAll('[data-dispatch-zone]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const zone = btn.getAttribute('data-dispatch-zone');
        const label = btn.getAttribute('data-dispatch-task');
        const state = btn.getAttribute('data-dispatch-state');
        sim.dispatchToSelected(zone, label, state);
      });
    });

    updateInspector(agents[0]);
  }

  syncThemeIcon();
  renderIcons();
  hydrateReleases();
  setupOfficeInspector();
})();

