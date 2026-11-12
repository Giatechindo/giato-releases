(function () {
  const canvas = document.getElementById('office-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Isometric constants
  const TILE_W = 54;
  const TILE_H = 27;
  const GRID_W = 13;
  const GRID_H = 10;

  let width = 800;
  let height = 500;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let paused = false;
  let simTime = 0;
  let tasksCompleted = 18;
  let activeScenario = 'swarm';
  let selectedAgentId = 'orchestrator';
  let hoveredAgentId = null;

  // Camera pan + subtle pointer tilt
  let camX = 0;
  let camY = 0;
  let zoom = 1;
  let dragging = false;
  let dragStart = { x: 0, y: 0, camX: 0, camY: 0, moved: false };
  let pointerTilt = { x: 0, y: 0 };

  const themeColors = () => {
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    return light
      ? {
          bg: '#efedf8',
          floorTop: '#ffffff',
          floorAlt: '#f6f4fc',
          floorEdgeL: '#d9d5eb',
          floorEdgeR: '#c8c3df',
          gridLine: '#e6e2f2',
          fiber: 'rgba(117, 87, 246, 0.25)',
          deskTop: '#f1effa',
          deskFront: '#dad6eb',
          deskSide: '#c9c4df',
          monitorFrame: '#252337',
          rackBody: '#272538',
          rackSide: '#1c1a29',
          text: '#1d1b2c',
          pillBg: 'rgba(255, 255, 255, 0.92)',
          pillBorder: 'rgba(117, 87, 246, 0.35)',
          zoneLabel: 'rgba(69, 70, 91, 0.72)'
        }
      : {
          bg: '#12111b',
          floorTop: '#1c1a27',
          floorAlt: '#201e2d',
          floorEdgeL: '#15131f',
          floorEdgeR: '#100e18',
          gridLine: '#2a273a',
          fiber: 'rgba(139, 104, 246, 0.32)',
          deskTop: '#2b283b',
          deskFront: '#201e2d',
          deskSide: '#171522',
          monitorFrame: '#0f0e17',
          rackBody: '#242234',
          rackSide: '#181624',
          text: '#f2f0f8',
          pillBg: 'rgba(21, 20, 30, 0.90)',
          pillBorder: 'rgba(167, 139, 250, 0.38)',
          zoneLabel: 'rgba(196, 192, 218, 0.58)'
        };
  };

  function iso(gx, gy, gz = 0) {
    const cx = width * 0.5 + camX;
    const cy = height * 0.23 + camY;
    const sx = cx + (gx - gy) * (TILE_W * 0.5) * zoom;
    const sy = cy + (gx + gy) * (TILE_H * 0.5) * zoom - gz * TILE_H * zoom;
    return { x: sx, y: sy };
  }

  function screenToGrid(sx, sy) {
    const cx = width * 0.5 + camX;
    const cy = height * 0.23 + camY;
    const dx = (sx - cx) / ((TILE_W * 0.5) * zoom);
    const dy = (sy - cy) / ((TILE_H * 0.5) * zoom);
    return { gx: (dx + dy) * 0.5, gy: (dy - dx) * 0.5 };
  }

  function drawIsoBox(gx, gy, gz, w, d, h, topCol, leftCol, rightCol, strokeCol) {
    const p00 = iso(gx, gy, gz + h);
    const p10 = iso(gx + w, gy, gz + h);
    const p11 = iso(gx + w, gy + d, gz + h);
    const p01 = iso(gx, gy + d, gz + h);

    const b10 = iso(gx + w, gy, gz);
    const b11 = iso(gx + w, gy + d, gz);
    const b01 = iso(gx, gy + d, gz);

    // Left visible face (gy + d)
    ctx.beginPath();
    ctx.moveTo(p01.x, p01.y);
    ctx.lineTo(p11.x, p11.y);
    ctx.lineTo(b11.x, b11.y);
    ctx.lineTo(b01.x, b01.y);
    ctx.closePath();
    ctx.fillStyle = leftCol;
    ctx.fill();
    if (strokeCol) {
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Right visible face (gx + w)
    ctx.beginPath();
    ctx.moveTo(p10.x, p10.y);
    ctx.lineTo(p11.x, p11.y);
    ctx.lineTo(b11.x, b11.y);
    ctx.lineTo(b10.x, b10.y);
    ctx.closePath();
    ctx.fillStyle = rightCol;
    ctx.fill();
    if (strokeCol) {
      ctx.strokeStyle = strokeCol;
      ctx.stroke();
    }

    // Top face
    ctx.beginPath();
    ctx.moveTo(p00.x, p00.y);
    ctx.lineTo(p10.x, p10.y);
    ctx.lineTo(p11.x, p11.y);
    ctx.lineTo(p01.x, p01.y);
    ctx.closePath();
    ctx.fillStyle = topCol;
    ctx.fill();
    if (strokeCol) {
      ctx.strokeStyle = strokeCol;
      ctx.stroke();
    }
  }

  // Zones & waypoints (walkable corridor lanes keep movement clean)
  const ZONES = {
    hub: { gx: 6.0, gy: 2.2, standX: 5.3, standY: 2.8, label: 'ORCHESTRATOR HUB' },
    coderA: { gx: 2.0, gy: 2.4, standX: 2.3, standY: 3.5, label: 'CODE BAY A' },
    coderB: { gx: 2.0, gy: 6.2, standX: 2.8, standY: 6.8, label: 'ARCHITECT BAY' },
    ssh: { gx: 9.8, gy: 2.0, standX: 9.1, standY: 3.1, label: 'SSH SERVER RACK' },
    vault: { gx: 9.6, gy: 6.4, standX: 8.8, standY: 6.8, label: 'SQLITE FTS5 / PG' },
    qa: { gx: 5.8, gy: 7.4, standX: 5.9, standY: 6.7, label: 'RELEASE PIPELINE' },
    lounge: { gx: 5.8, gy: 4.8, standX: 5.8, standY: 4.8, label: 'SYNC LOUNGE' }
  };

  // Agents roster
  const agents = [
    {
      id: 'orchestrator',
      name: 'Coordinator',
      role: 'Task Swarm Lead',
      color: '#7557f6',
      zone: 'hub',
      gx: ZONES.hub.standX,
      gy: ZONES.hub.standY,
      targetX: ZONES.hub.standX,
      targetY: ZONES.hub.standY,
      waypoints: [],
      state: 'DELEGATING',
      task: 'Routing workspace swarm',
      model: 'Coordinator Core',
      logs: [
        'Swarm board initialized (6 agents)',
        'Pinned Coder-01 -> electron-builder targets',
        'Streaming update.json manifest'
      ],
      timer: 2.2
    },
    {
      id: 'architect',
      name: 'Architect',
      role: 'Specs & Git Diffs',
      color: '#38bdf8',
      zone: 'coderB',
      gx: ZONES.coderB.standX,
      gy: ZONES.coderB.standY,
      targetX: ZONES.coderB.standX,
      targetY: ZONES.coderB.standY,
      waypoints: [],
      state: 'REVIEWING',
      task: 'Inspecting git diff & AST',
      model: 'Reasoning Engine',
      logs: [
        'Parsed workspace layout diff (+42/-11)',
        'Verified IPC contract types',
        'No duplicate helpers detected'
      ],
      timer: 3.8
    },
    {
      id: 'coder',
      name: 'Coder-01',
      role: 'Code & Build Worker',
      color: '#a78bfa',
      zone: 'coderA',
      gx: ZONES.coderA.standX,
      gy: ZONES.coderA.standY,
      targetX: ZONES.coderA.standX,
      targetY: ZONES.coderA.standY,
      waypoints: [],
      state: 'CODING',
      task: 'Compiling TypeScript + Vite',
      model: 'Code Specialist',
      logs: [
        'vite build: 3,718 modules bundled',
        'Patched preload IPC bindings',
        'Running tsc --noEmit (0 errors)'
      ],
      timer: 3.1
    },
    {
      id: 'sshops',
      name: 'SSH-Ops',
      role: 'Server & Tunnel Agent',
      color: '#10b981',
      zone: 'ssh',
      gx: ZONES.ssh.standX,
      gy: ZONES.ssh.standY,
      targetX: ZONES.ssh.standX,
      targetY: ZONES.ssh.standY,
      waypoints: [],
      state: 'CONNECTED',
      task: 'Tailing systemd via SSH',
      model: 'Ops Shell Agent',
      logs: [
        'SSH tunnel -> prod-node-01:22 OK',
        'pm2 status: 4 workers online',
        'RAM 41% | Disk 28% | Zero errors'
      ],
      timer: 4.5
    },
    {
      id: 'memory',
      name: 'Memory-DB',
      role: 'SQLite FTS5 & Postgres',
      color: '#f59e0b',
      zone: 'vault',
      gx: ZONES.vault.standX,
      gy: ZONES.vault.standY,
      targetX: ZONES.vault.standX,
      targetY: ZONES.vault.standY,
      waypoints: [],
      state: 'INDEXING',
      task: 'Syncing encrypted PG deltas',
      model: 'Storage Engine',
      logs: [
        'SQLite WAL checkpoint clean (0.4ms)',
        'FTS5 index refreshed: 1,284 messages',
        'Postgres 2-way sync idle & ready'
      ],
      timer: 4.0
    },
    {
      id: 'verifier',
      name: 'Verifier',
      role: 'QA & Release Packaging',
      color: '#fb7185',
      zone: 'qa',
      gx: ZONES.qa.standX,
      gy: ZONES.qa.standY,
      targetX: ZONES.qa.standX,
      targetY: ZONES.qa.standY,
      waypoints: [],
      state: 'TESTING',
      task: 'Checking 63/63 unit tests',
      model: 'Release Runner',
      logs: [
        'Unit suite: 63 passed, 0 failed',
        'Electron fuses verified cleanly',
        'DMG / EXE / MSI / AppImage / DEB green'
      ],
      timer: 2.9
    }
  ];

  // Animated glowing data packets flowing between agents / stations
  const packets = [];
  function spawnPacket(fromZone, toZone, color, label) {
    const a = ZONES[fromZone];
    const b = ZONES[toZone];
    if (!a || !b) return;
    packets.push({
      x0: a.gx,
      y0: a.gy,
      x1: b.gx,
      y1: b.gy,
      t: 0,
      speed: 0.9 + Math.random() * 0.45,
      color,
      label
    });
  }

  function pushAgentLog(agent, msg) {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    agent.logs.unshift(`[${hh}:${mm}:${ss}] ${msg}`);
    if (agent.logs.length > 5) agent.logs.pop();
    if (agent.id === selectedAgentId) {
      window.dispatchEvent(new CustomEvent('giato:agent-updated', { detail: agent }));
    }
  }

  function sendAgentTo(agent, zoneKey, taskText, nextState) {
    const z = ZONES[zoneKey];
    if (!z) return;
    const jitterX = (Math.random() - 0.5) * 0.45;
    const jitterY = (Math.random() - 0.5) * 0.45;
    const destX = z.standX + jitterX;
    const destY = z.standY + jitterY;
    // Walk via central aisle waypoint (x=5.6, y=4.8) if crossing quadrants to look natural
    const farApart = Math.hypot(destX - agent.gx, destY - agent.gy) > 4.2;
    agent.waypoints = farApart
      ? [{ x: 5.6 + (Math.random() - 0.5) * 0.6, y: 4.8 + (Math.random() - 0.5) * 0.6 }, { x: destX, y: destY }]
      : [{ x: destX, y: destY }];
    agent.zone = zoneKey;
    agent.task = taskText;
    agent.state = nextState || 'WORKING';
    agent.timer = 4.2 + Math.random() * 3.5;
  }

  const SCENARIOS = {
    swarm: () => {
      sendAgentTo(agents[0], 'hub', 'Coordinating parallel swarm', 'DELEGATING');
      sendAgentTo(agents[1], 'coderB', 'Auditing workspace diffs', 'REVIEWING');
      sendAgentTo(agents[2], 'coderA', 'Implementing React shell', 'CODING');
      sendAgentTo(agents[3], 'ssh', 'Monitoring VPS nodes via SSH', 'CONNECTED');
      sendAgentTo(agents[4], 'vault', 'Indexing SQLite FTS5 store', 'INDEXING');
      sendAgentTo(agents[5], 'qa', 'Running 63 regression assertions', 'TESTING');
      spawnPacket('hub', 'coderA', '#7557f6', 'brief');
      spawnPacket('hub', 'ssh', '#10b981', 'ssh');
      spawnPacket('hub', 'vault', '#f59e0b', 'fts5');
    },
    release: () => {
      sendAgentTo(agents[0], 'qa', 'Supervising multi-OS release', 'SHIPPING');
      sendAgentTo(agents[2], 'coderA', 'Bundling dist-electron + vite', 'BUNDLING');
      sendAgentTo(agents[5], 'qa', 'Building DMG, EXE, MSI, AppImage', 'PACKAGING');
      sendAgentTo(agents[1], 'hub', 'Generating SHA256SUMS + feed', 'SIGNING');
      sendAgentTo(agents[4], 'vault', 'Updating update.json manifest', 'PUBLISHING');
      sendAgentTo(agents[3], 'lounge', 'Standby for post-release deploy', 'STANDBY');
      spawnPacket('coderA', 'qa', '#a78bfa', 'asar');
      spawnPacket('qa', 'hub', '#fb7185', 'tag v0.2');
      pushAgentLog(agents[5], 'GitHub Actions matrix started (macOS/Win/Linux)');
    },
    ssh: () => {
      sendAgentTo(agents[3], 'ssh', 'Executing remote deploy script', 'TUNNELING');
      sendAgentTo(agents[0], 'ssh', 'Verifying container health', 'AUDITING');
      sendAgentTo(agents[4], 'vault', 'Rotating encrypted SSH host logs', 'SYNCING');
      sendAgentTo(agents[2], 'coderB', 'Patching nginx reverse proxy', 'EDITING');
      sendAgentTo(agents[5], 'ssh', 'Probing HTTPS health endpoint', 'PROBING');
      spawnPacket('hub', 'ssh', '#10b981', 'ssh -t');
      spawnPacket('ssh', 'vault', '#f59e0b', 'pg_sync');
      pushAgentLog(agents[3], 'Connected to prod-gateway (latency 18ms)');
    },
    db: () => {
      sendAgentTo(agents[4], 'vault', 'Running SQLite WAL checkpoint', 'CHECKPOINT');
      sendAgentTo(agents[1], 'vault', 'Verifying 2-way Postgres merge', 'MERGING');
      sendAgentTo(agents[0], 'lounge', 'Reviewing offline-first telemetry', 'SYNCING');
      sendAgentTo(agents[5], 'qa', 'Testing zero-data-loss logout', 'VERIFYING');
      spawnPacket('coderA', 'vault', '#f59e0b', 'wal');
      spawnPacket('vault', 'hub', '#38bdf8', 'commit');
      pushAgentLog(agents[4], 'Encrypted delta pushed: 0 conflicts');
    }
  };

  function autonomousTick(dt) {
    agents.forEach((a) => {
      // Walk along waypoints
      if (a.waypoints.length > 0) {
        const wp = a.waypoints[0];
        const dx = wp.x - a.gx;
        const dy = wp.y - a.gy;
        const dist = Math.hypot(dx, dy);
        const speed = 1.65;
        if (dist < 0.08) {
          a.gx = wp.x;
          a.gy = wp.y;
          a.waypoints.shift();
        } else {
          a.gx += (dx / dist) * speed * dt;
          a.gy += (dy / dist) * speed * dt;
        }
        return;
      }

      a.timer -= dt;
      if (a.timer <= 0) {
        tasksCompleted += 1;
        const hudTasks = document.getElementById('hud-tasks');
        if (hudTasks) hudTasks.textContent = String(tasksCompleted);

        // Rotate agents organically across stations so the office feels genuinely alive
        const r = Math.random();
        if (a.id === 'orchestrator') {
          const targets = ['hub', 'lounge', 'qa', 'coderA'];
          const z = targets[Math.floor(Math.random() * targets.length)];
          sendAgentTo(a, z, z === 'lounge' ? 'Syncing agent statuses' : 'Delegating task slice', 'COORDINATING');
          spawnPacket('hub', z === 'hub' ? 'coderA' : z, a.color, 'assign');
          pushAgentLog(a, `Dispatched subtask -> ${ZONES[z].label}`);
        } else if (r < 0.24) {
          sendAgentTo(a, 'lounge', 'Brief sync at whiteboard', 'SYNCING');
          pushAgentLog(a, 'Joined quick standup at sync lounge');
        } else {
          const homeMap = {
            architect: ['coderB', 'Checking AST dependencies', 'REVIEWING'],
            coder: ['coderA', 'Writing TypeScript module', 'CODING'],
            sshops: ['ssh', 'Streaming journalctl -f', 'CONNECTED'],
            memory: ['vault', 'Vacuuming SQLite FTS5', 'INDEXING'],
            verifier: ['qa', 'Verifying SHA-256 build', 'TESTING']
          };
          const [hz, ht, hs] = homeMap[a.id] || ['hub', 'Executing task', 'ACTIVE'];
          const collab = r < 0.45 ? 'hub' : hz;
          sendAgentTo(a, collab, collab === 'hub' ? 'Reporting output to Coordinator' : ht, hs);
          spawnPacket(collab === 'hub' ? hz : 'hub', collab, a.color, 'sync');
          pushAgentLog(a, collab === 'hub' ? 'Synced deliverable with Coordinator' : ht);
        }
      }
    });

    // Advance flying packets
    for (let i = packets.length - 1; i >= 0; i -= 1) {
      packets[i].t += packets[i].speed * dt;
      if (packets[i].t >= 1) packets.splice(i, 1);
    }
  }

  function drawFloorAndTracks(c) {
    // Outer isometric floor slab
    drawIsoBox(0, 0, -0.35, GRID_W, GRID_H, 0.35, c.floorTop, c.floorEdgeL, c.floorEdgeR, c.gridLine);

    // Checkerboard architectural grid lines
    for (let x = 0; x < GRID_W; x += 1) {
      for (let y = 0; y < GRID_H; y += 1) {
        const p0 = iso(x, y, 0);
        const p1 = iso(x + 1, y, 0);
        const p2 = iso(x + 1, y + 1, 0);
        const p3 = iso(x, y + 1, 0);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        if ((x + y) % 2 === 1) {
          ctx.fillStyle = c.floorAlt;
          ctx.fill();
        }
        ctx.strokeStyle = c.gridLine;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    }

    // Glowing under-floor fiber routes connecting Hub to every bay
    const routes = [
      ['hub', 'coderA'],
      ['hub', 'coderB'],
      ['hub', 'ssh'],
      ['hub', 'vault'],
      ['hub', 'qa']
    ];
    ctx.save();
    ctx.strokeStyle = c.fiber;
    ctx.lineWidth = 2 * zoom;
    ctx.setLineDash([5 * zoom, 5 * zoom]);
    ctx.lineDashOffset = -simTime * 20;
    routes.forEach(([fromK, toK]) => {
      const pA = iso(ZONES[fromK].gx, ZONES[fromK].gy, 0.02);
      const pB = iso(ZONES[toK].gx, ZONES[toK].gy, 0.02);
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.stroke();
    });
    ctx.restore();

    // Subtle zone tags
    ctx.save();
    ctx.font = `600 ${Math.max(9, Math.round(9.5 * zoom))}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    Object.values(ZONES).forEach((z) => {
      const p = iso(z.gx + 0.5, z.gy + 1.35, 0.02);
      ctx.fillStyle = c.zoneLabel;
      ctx.fillText(z.label, p.x, p.y);
    });
    ctx.restore();
  }

  function drawDeskWithMonitors(gx, gy, c, accentColor, screenPhase) {
    // Desk base
    drawIsoBox(gx, gy, 0, 1.5, 0.85, 0.72, c.deskTop, c.deskFront, c.deskSide, c.gridLine);
    // Left monitor
    drawIsoBox(gx + 0.2, gy + 0.12, 0.74, 0.5, 0.12, 0.56, '#393650', c.monitorFrame, '#181625', c.gridLine);
    // Right monitor
    drawIsoBox(gx + 0.82, gy + 0.12, 0.74, 0.5, 0.12, 0.56, '#393650', c.monitorFrame, '#181625', c.gridLine);

    // Animated glowing code lines on screens
    const s1 = iso(gx + 0.26, gy + 0.25, 1.12);
    const s2 = iso(gx + 0.88, gy + 0.25, 1.12);
    [s1, s2].forEach((pt, idx) => {
      for (let line = 0; line < 3; line += 1) {
        const pulse = 0.45 + 0.55 * Math.sin(simTime * 3.5 + screenPhase + idx * 1.4 + line);
        const w = (7 + ((line * 5 + idx * 3) % 7)) * zoom;
        ctx.fillStyle = line === 0 ? accentColor : `rgba(167, 139, 250, ${0.38 + pulse * 0.45})`;
        ctx.fillRect(pt.x - 4 * zoom, pt.y + line * 4 * zoom, w, 2 * zoom);
      }
    });
  }

  function drawServerRack(gx, gy, c) {
    drawIsoBox(gx, gy, 0, 0.9, 0.9, 1.95, '#3b3754', c.rackBody, c.rackSide, c.gridLine);
    // Blinking SSH rack LEDs on front face
    for (let row = 0; row < 5; row += 1) {
      const p = iso(gx + 0.25, gy + 0.91, 1.65 - row * 0.3);
      const blink = Math.sin(simTime * 5 + row * 1.9) > 0;
      ctx.fillStyle = row % 2 === 0 ? (blink ? '#4ade80' : '#166534') : '#8b68f6';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.3 * zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(p.x + 5 * zoom, p.y - 1 * zoom, 12 * zoom, 2 * zoom);
    }
  }

  function drawVaultPlinth(gx, gy, c) {
    drawIsoBox(gx, gy, 0, 1.3, 1.3, 0.45, c.deskTop, c.deskFront, c.deskSide, c.gridLine);
    drawIsoBox(gx + 0.25, gy + 0.25, 0.45, 0.8, 0.8, 1.15, '#5034bd', '#2e2942', '#201c30', '#7557f6');
    // Pulsing storage ring
    const top = iso(gx + 0.65, gy + 0.65, 1.7 + Math.sin(simTime * 2.5) * 0.12);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.8 * zoom;
    ctx.beginPath();
    ctx.ellipse(top.x, top.y, 12 * zoom, 6 * zoom, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawWhiteboardLounge(gx, gy, c) {
    // Magnetic whiteboard
    drawIsoBox(gx - 0.6, gy - 0.6, 0, 1.4, 0.15, 1.45, '#e2e0f0', '#ffffff', '#c8c4dc', c.gridLine);
    const wb = iso(gx - 0.15, gy - 0.44, 0.9);
    ctx.strokeStyle = '#7557f6';
    ctx.lineWidth = 1.5 * zoom;
    ctx.beginPath();
    ctx.moveTo(wb.x - 10 * zoom, wb.y);
    ctx.lineTo(wb.x + 2 * zoom, wb.y - 5 * zoom);
    ctx.lineTo(wb.x + 12 * zoom, wb.y + 3 * zoom);
    ctx.stroke();
    // Low round meeting table
    drawIsoBox(gx - 0.25, gy + 0.1, 0, 0.9, 0.9, 0.48, c.deskTop, c.deskFront, c.deskSide, c.gridLine);
  }

  function drawAgent(agent, c) {
    const walking = agent.waypoints.length > 0;
    const bob = walking ? Math.abs(Math.sin(simTime * 11)) * 0.14 : Math.sin(simTime * 2.4 + agent.gx) * 0.03;
    const base = iso(agent.gx, agent.gy, 0);

    // Selection or hover reticle ring
    const selected = agent.id === selectedAgentId;
    const hovered = agent.id === hoveredAgentId;
    if (selected || hovered) {
      ctx.save();
      ctx.strokeStyle = selected ? '#7557f6' : 'rgba(255,255,255,0.55)';
      ctx.lineWidth = (selected ? 2.4 : 1.4) * zoom;
      ctx.beginPath();
      ctx.ellipse(base.x, base.y, 18 * zoom, 9 * zoom, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Contact shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, 11 * zoom, 5.5 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sculpted 2.5D Bot Body
    const bodyPos = iso(agent.gx, agent.gy, 0.12 + bob);
    const bodyH = 19 * zoom;
    const bodyW = 13 * zoom;

    // Legs / hover base
    ctx.fillStyle = '#252337';
    ctx.fillRect(bodyPos.x - 4.5 * zoom, bodyPos.y - 4 * zoom, 3.5 * zoom, 5 * zoom);
    ctx.fillRect(bodyPos.x + 1 * zoom, bodyPos.y - 4 * zoom, 3.5 * zoom, 5 * zoom);

    // Torso
    ctx.fillStyle = agent.color;
    ctx.beginPath();
    ctx.roundRect(bodyPos.x - bodyW * 0.5, bodyPos.y - bodyH, bodyW, bodyH - 3 * zoom, 5 * zoom);
    ctx.fill();

    // Head + Glowing AI Visor
    const headY = bodyPos.y - bodyH - 9 * zoom;
    ctx.fillStyle = '#181625';
    ctx.beginPath();
    ctx.roundRect(bodyPos.x - 7.5 * zoom, headY, 15 * zoom, 11 * zoom, 5 * zoom);
    ctx.fill();
    ctx.strokeStyle = agent.color;
    ctx.lineWidth = 1.2 * zoom;
    ctx.stroke();

    // Visor slit
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(bodyPos.x - 4.5 * zoom, headY + 4 * zoom, 9 * zoom, 2.3 * zoom);

    // Floating Name & State Pill
    const labelY = headY - 12 * zoom;
    ctx.font = `600 ${Math.max(9.5, Math.round(10 * zoom))}px "JetBrains Mono", monospace`;
    const tag = `${agent.name} · ${agent.state}`;
    const textW = ctx.measureText(tag).width;
    const pillW = textW + 14;
    const pillH = 18;

    ctx.fillStyle = c.pillBg;
    ctx.strokeStyle = selected ? agent.color : c.pillBorder;
    ctx.lineWidth = selected ? 1.5 : 1;
    ctx.beginPath();
    ctx.roundRect(bodyPos.x - pillW * 0.5, labelY - pillH * 0.5, pillW, pillH, 999);
    ctx.fill();
    ctx.stroke();

    // Status dot inside pill
    ctx.fillStyle = agent.color;
    ctx.beginPath();
    ctx.arc(bodyPos.x - pillW * 0.5 + 7, labelY, 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = c.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tag, bodyPos.x + 4, labelY + 0.5);
  }

  function render() {
    const c = themeColors();
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, width, height);

    drawFloorAndTracks(c);

    // Collect depth-sorted objects + agents (Painter's algorithm by gx + gy)
    const drawList = [
      { depth: ZONES.hub.gx + ZONES.hub.gy, draw: () => drawDeskWithMonitors(ZONES.hub.gx - 0.5, ZONES.hub.gy - 0.5, c, '#7557f6', 0.2) },
      { depth: ZONES.coderA.gx + ZONES.coderA.gy, draw: () => drawDeskWithMonitors(ZONES.coderA.gx - 0.4, ZONES.coderA.gy - 0.2, c, '#a78bfa', 1.5) },
      { depth: ZONES.coderB.gx + ZONES.coderB.gy, draw: () => drawDeskWithMonitors(ZONES.coderB.gx - 0.2, ZONES.coderB.gy - 0.4, c, '#38bdf8', 2.8) },
      { depth: ZONES.ssh.gx + ZONES.ssh.gy, draw: () => { drawServerRack(ZONES.ssh.gx - 0.6, ZONES.ssh.gy - 0.4, c); drawServerRack(ZONES.ssh.gx + 0.45, ZONES.ssh.gy - 0.4, c); } },
      { depth: ZONES.vault.gx + ZONES.vault.gy, draw: () => drawVaultPlinth(ZONES.vault.gx - 0.4, ZONES.vault.gy - 0.4, c) },
      { depth: ZONES.qa.gx + ZONES.qa.gy, draw: () => drawDeskWithMonitors(ZONES.qa.gx - 0.6, ZONES.qa.gy + 0.2, c, '#fb7185', 4.1) },
      { depth: ZONES.lounge.gx + ZONES.lounge.gy, draw: () => drawWhiteboardLounge(ZONES.lounge.gx, ZONES.lounge.gy, c) }
    ];

    agents.forEach((agent) => {
      drawList.push({
        depth: agent.gx + agent.gy + 0.35,
        draw: () => drawAgent(agent, c)
      });
    });

    drawList.sort((a, b) => a.depth - b.depth);
    drawList.forEach((item) => item.draw());

    // Render flying data packets on top
    packets.forEach((pk) => {
      const gx = pk.x0 + (pk.x1 - pk.x0) * pk.t;
      const gy = pk.y0 + (pk.y1 - pk.y0) * pk.t;
      const arcZ = 0.6 + Math.sin(pk.t * Math.PI) * 1.45;
      const pt = iso(gx, gy, arcZ);

      ctx.save();
      ctx.fillStyle = pk.color;
      ctx.shadowColor = pk.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4 * zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    width = Math.max(320, rect.width);
    height = Math.max(390, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Responsive auto zoom
    zoom = Math.max(0.68, Math.min(1.12, width / 840));
  }

  let lastTs = performance.now();
  function frame(ts) {
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    if (!paused) {
      simTime += dt;
      autonomousTick(dt);
    }
    render();
    requestAnimationFrame(frame);
  }

  // Pointer & Drag / Click Agent Hit-testing
  function pickAgentAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    let best = null;
    let bestDist = 34 * zoom;
    agents.forEach((a) => {
      const p = iso(a.gx, a.gy, 0.55);
      const d = Math.hypot(p.x - sx, p.y - sy);
      if (d < bestDist) {
        bestDist = d;
        best = a;
      }
    });
    return best;
  }

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    dragStart = { x: e.clientX, y: e.clientY, camX, camY, moved: false };
  });

  window.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
      pointerTilt.x = ((e.clientX - rect.left) / rect.width - 0.5) * 4;
      pointerTilt.y = ((e.clientY - rect.top) / rect.height - 0.5) * -4;
      canvas.style.transform = `rotateX(${pointerTilt.y.toFixed(2)}deg) rotateY(${pointerTilt.x.toFixed(2)}deg)`;
      const hit = pickAgentAt(e.clientX, e.clientY);
      hoveredAgentId = hit ? hit.id : null;
      canvas.style.cursor = dragging ? 'grabbing' : hit ? 'pointer' : 'grab';
    }
    if (!dragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    if (Math.hypot(dx, dy) > 4) dragStart.moved = true;
    camX = Math.max(-180, Math.min(180, dragStart.camX + dx));
    camY = Math.max(-120, Math.min(120, dragStart.camY + dy));
  });

  window.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    if (!dragStart.moved) {
      const hit = pickAgentAt(e.clientX, e.clientY);
      if (hit) {
        selectAgent(hit.id);
      } else {
        // Click floor to send currently selected agent there cleanly!
        const rect = canvas.getBoundingClientRect();
        const g = screenToGrid(e.clientX - rect.left, e.clientY - rect.top);
        if (g.gx >= 0.8 && g.gx <= GRID_W - 0.8 && g.gy >= 0.8 && g.gy <= GRID_H - 0.8) {
          const active = agents.find((a) => a.id === selectedAgentId);
          if (active) {
            active.waypoints = [{ x: g.gx, y: g.gy }];
            active.state = 'INSPECTING';
            active.task = `Moving to grid (${g.gx.toFixed(1)}, ${g.gy.toFixed(1)})`;
            pushAgentLog(active, `Walked to (${g.gx.toFixed(1)}, ${g.gy.toFixed(1)})`);
          }
        }
      }
    }
  });

  canvas.addEventListener('mouseleave', () => {
    canvas.style.transform = 'rotateX(0deg) rotateY(0deg)';
  });

  function selectAgent(id) {
    selectedAgentId = id;
    const agent = agents.find((a) => a.id === id) || agents[0];
    window.dispatchEvent(new CustomEvent('giato:agent-selected', { detail: agent }));
  }

  // Expose controls for app.js UI
  window.GiatoOfficeSim = {
    getAgents: () => agents,
    getSelectedId: () => selectedAgentId,
    selectAgent,
    runScenario: (name) => {
      activeScenario = name;
      if (SCENARIOS[name]) SCENARIOS[name]();
      return activeScenario;
    },
    dispatchToSelected: (zoneKey, text, state) => {
      const agent = agents.find((a) => a.id === selectedAgentId);
      if (!agent) return;
      sendAgentTo(agent, zoneKey, text, state);
      spawnPacket('hub', zoneKey, agent.color, 'task');
      pushAgentLog(agent, text);
    },
    togglePause: () => {
      paused = !paused;
      return paused;
    },
    resetView: () => {
      camX = 0;
      camY = 0;
      resize();
    }
  };

  window.addEventListener('resize', resize);
  resize();
  SCENARIOS.swarm();
  requestAnimationFrame(frame);
})();

