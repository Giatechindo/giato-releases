(function () {
  const canvas = document.getElementById('office-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const TILE_W = 54;
  const GRID_W = 13;
  const GRID_H = 10;
  const ROOM_CX = GRID_W * 0.5;
  const ROOM_CY = GRID_H * 0.5;

  let width = 800;
  let height = 520;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let paused = false;
  let simTime = 0;
  let selectedAgentId = 'orchestrator';
  let hoveredAgentId = null;
  let currentLang = localStorage.getItem('giato-web-lang') || 'en';

  // Interactive 3D Orbit, Tilt, Zoom & Pan
  let baseZoom = 1;
  let userZoom = 1;
  let targetZoom = 1;
  let rotAngle = 0.0;
  let targetRot = 0.0;
  let pitch = 0.5;
  let targetPitch = 0.5;
  let camX = 0;
  let camY = 0;

  let dragging = false;
  let dragMode = 'orbit';
  let dragStart = { x: 0, y: 0, rot: 0, pitch: 0.5, camX: 0, camY: 0, moved: false };

  const themeColors = () => {
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    return light
      ? {
          bg: '#eeecf7',
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
          zoneLabel: 'rgba(69, 70, 91, 0.7)'
        }
      : {
          bg: '#100f18',
          floorTop: '#1c1a27',
          floorAlt: '#201e2d',
          floorEdgeL: '#15131f',
          floorEdgeR: '#0d0c15',
          gridLine: '#2a273a',
          fiber: 'rgba(139, 104, 246, 0.34)',
          deskTop: '#2b283b',
          deskFront: '#201e2d',
          deskSide: '#171522',
          monitorFrame: '#0f0e17',
          rackBody: '#242234',
          rackSide: '#181624',
          text: '#f2f0f8',
          pillBg: 'rgba(19, 18, 27, 0.90)',
          pillBorder: 'rgba(167, 139, 250, 0.40)',
          zoneLabel: 'rgba(196, 192, 218, 0.56)'
        };
  };

  function rotateGrid(gx, gy) {
    const dx = gx - ROOM_CX;
    const dy = gy - ROOM_CY;
    const c = Math.cos(rotAngle);
    const s = Math.sin(rotAngle);
    return {
      rx: dx * c - dy * s,
      ry: dx * s + dy * c
    };
  }

  function depthOf(gx, gy) {
    const { rx, ry } = rotateGrid(gx, gy);
    return rx + ry;
  }

  function iso(gx, gy, gz = 0) {
    const { rx, ry } = rotateGrid(gx, gy);
    const scale = TILE_W * 0.5 * baseZoom * userZoom;
    const cx = width * 0.5 + camX;
    const cy = height * 0.52 + camY;
    const sx = cx + (rx - ry) * scale;
    const sy = cy + (rx + ry) * scale * pitch - gz * scale * 0.98;
    return { x: sx, y: sy };
  }

  function screenToGrid(sx, sy) {
    const scale = TILE_W * 0.5 * baseZoom * userZoom;
    const cx = width * 0.5 + camX;
    const cy = height * 0.52 + camY;
    const u = (sx - cx) / scale;
    const v = (sy - cy) / (scale * pitch);
    const rx = (u + v) * 0.5;
    const ry = (v - u) * 0.5;
    const c = Math.cos(-rotAngle);
    const s = Math.sin(-rotAngle);
    return {
      gx: ROOM_CX + rx * c - ry * s,
      gy: ROOM_CY + rx * s + ry * c
    };
  }

  function drawIsoBox(gx, gy, gz, w, d, h, topCol, leftCol, rightCol, strokeCol) {
    const corners = [
      [gx, gy],
      [gx + w, gy],
      [gx + w, gy + d],
      [gx, gy + d]
    ];
    const top = corners.map(([x, y]) => iso(x, y, gz + h));
    const bot = corners.map(([x, y]) => iso(x, y, gz));
    const center = rotateGrid(gx + w * 0.5, gy + d * 0.5);
    const centerSum = center.rx + center.ry;
    const centerDiff = center.rx - center.ry;

    for (let i = 0; i < 4; i += 1) {
      const next = (i + 1) % 4;
      const mx = (corners[i][0] + corners[next][0]) * 0.5;
      const my = (corners[i][1] + corners[next][1]) * 0.5;
      const fm = rotateGrid(mx, my);
      // Only draw front-facing vertical faces for the current 360° angle
      if (fm.rx + fm.ry > centerSum + 0.001) {
        const isLeft = fm.rx - fm.ry < centerDiff;
        ctx.beginPath();
        ctx.moveTo(top[i].x, top[i].y);
        ctx.lineTo(top[next].x, top[next].y);
        ctx.lineTo(bot[next].x, bot[next].y);
        ctx.lineTo(bot[i].x, bot[i].y);
        ctx.closePath();
        ctx.fillStyle = isLeft ? leftCol : rightCol;
        ctx.fill();
        if (strokeCol) {
          ctx.strokeStyle = strokeCol;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }

    ctx.beginPath();
    ctx.moveTo(top[0].x, top[0].y);
    ctx.lineTo(top[1].x, top[1].y);
    ctx.lineTo(top[2].x, top[2].y);
    ctx.lineTo(top[3].x, top[3].y);
    ctx.closePath();
    ctx.fillStyle = topCol;
    ctx.fill();
    if (strokeCol) {
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  const TEXT = {
    en: {
      zones: {
        hub: 'HUB',
        coderA: 'CODE BAY',
        coderB: 'ARCHITECT',
        ssh: 'SERVERS',
        vault: 'STORAGE',
        qa: 'RELEASE QA',
        lounge: 'LOUNGE'
      },
      states: {
        active: 'ACTIVE',
        review: 'REVIEW',
        coding: 'CODING',
        online: 'ONLINE',
        sync: 'SYNC',
        testing: 'TESTING',
        release: 'RELEASE',
        standby: 'STANDBY',
        discuss: 'SYNC'
      },
      tasks: {
        coord: 'Delegating team tasks',
        coordSync: 'Syncing with agents',
        arch: 'Reviewing code diffs',
        coder: 'Writing app features',
        ssh: 'Monitoring SSH servers',
        vault: 'Saving local workspace',
        qa: 'Running build checks',
        lounge: 'Quick sync at whiteboard',
        report: 'Reporting progress to Hub',
        scRelease1: 'Coordinating multi-OS build',
        scRelease2: 'Packaging DMG, EXE, MSI, DEB',
        scRelease3: 'Publishing update feed',
        scSsh1: 'Opening SSH host session',
        scSsh2: 'Checking server health',
        scDb1: 'Indexing local history',
        scDb2: 'Syncing database deltas'
      }
    },
    id: {
      zones: {
        hub: 'HUB',
        coderA: 'RUANG KODE',
        coderB: 'ARSITEK',
        ssh: 'SERVER SSH',
        vault: 'DATA LOKAL',
        qa: 'UJI RILIS',
        lounge: 'LOUNGE'
      },
      states: {
        active: 'AKTIF',
        review: 'REVIEW',
        coding: 'CODING',
        online: 'ONLINE',
        sync: 'SYNC',
        testing: 'UJI',
        release: 'RILIS',
        standby: 'SIAGA',
        discuss: 'DISKUSI'
      },
      tasks: {
        coord: 'Membagi tugas ke tim',
        coordSync: 'Koordinasi cepat dengan tim',
        arch: 'Memeriksa perubahan kode',
        coder: 'Menulis fitur aplikasi',
        ssh: 'Memantau server SSH',
        vault: 'Menyimpan data lokal',
        qa: 'Menguji paket aplikasi',
        lounge: 'Sinkronisasi singkat di lounge',
        report: 'Melaporkan hasil ke Hub',
        scRelease1: 'Mengawal rilis lintas OS',
        scRelease2: 'Membuat DMG, EXE, MSI, DEB',
        scRelease3: 'Memperbarui feed update',
        scSsh1: 'Membuka terminal SSH server',
        scSsh2: 'Memeriksa layanan server',
        scDb1: 'Merapikan indeks lokal',
        scDb2: 'Sinkronisasi database'
      }
    }
  };

  const t = () => TEXT[currentLang] || TEXT.en;

  const ZONES = {
    hub: { gx: 6.0, gy: 2.2, standX: 5.3, standY: 2.8 },
    coderA: { gx: 2.0, gy: 2.4, standX: 2.3, standY: 3.5 },
    coderB: { gx: 2.0, gy: 6.2, standX: 2.8, standY: 6.8 },
    ssh: { gx: 9.8, gy: 2.0, standX: 9.1, standY: 3.1 },
    vault: { gx: 9.6, gy: 6.4, standX: 8.8, standY: 6.8 },
    qa: { gx: 5.8, gy: 7.4, standX: 5.9, standY: 6.7 },
    lounge: { gx: 5.8, gy: 4.8, standX: 5.8, standY: 4.8 }
  };

  const agents = [
    { id: 'orchestrator', name: 'Coordinator', color: '#7557f6', zone: 'hub', gx: ZONES.hub.standX, gy: ZONES.hub.standY, waypoints: [], stateKey: 'active', taskKey: 'coord', timer: 2.2 },
    { id: 'architect', name: 'Architect', color: '#38bdf8', zone: 'coderB', gx: ZONES.coderB.standX, gy: ZONES.coderB.standY, waypoints: [], stateKey: 'review', taskKey: 'arch', timer: 3.8 },
    { id: 'coder', name: 'Coder', color: '#a78bfa', zone: 'coderA', gx: ZONES.coderA.standX, gy: ZONES.coderA.standY, waypoints: [], stateKey: 'coding', taskKey: 'coder', timer: 3.1 },
    { id: 'sshops', name: 'Server Ops', color: '#10b981', zone: 'ssh', gx: ZONES.ssh.standX, gy: ZONES.ssh.standY, waypoints: [], stateKey: 'online', taskKey: 'ssh', timer: 4.5 },
    { id: 'memory', name: 'Database', color: '#f59e0b', zone: 'vault', gx: ZONES.vault.standX, gy: ZONES.vault.standY, waypoints: [], stateKey: 'sync', taskKey: 'vault', timer: 4.0 },
    { id: 'verifier', name: 'Tester', color: '#fb7185', zone: 'qa', gx: ZONES.qa.standX, gy: ZONES.qa.standY, waypoints: [], stateKey: 'testing', taskKey: 'qa', timer: 2.9 }
  ];

  function hydrateAgentText(a) {
    const dict = t();
    a.state = dict.states[a.stateKey] || a.stateKey.toUpperCase();
    a.task = a.customTask || dict.tasks[a.taskKey] || '';
  }
  agents.forEach(hydrateAgentText);

  const packets = [];
  function spawnPacket(fromZone, toZone, color) {
    const a = ZONES[fromZone];
    const b = ZONES[toZone];
    if (!a || !b) return;
    packets.push({ x0: a.gx, y0: a.gy, x1: b.gx, y1: b.gy, t: 0, speed: 0.9 + Math.random() * 0.45, color });
  }

  function sendAgentTo(agent, zoneKey, taskKey, stateKey, customTask) {
    const z = ZONES[zoneKey];
    if (!z) return;
    const destX = z.standX + (Math.random() - 0.5) * 0.45;
    const destY = z.standY + (Math.random() - 0.5) * 0.45;
    const farApart = Math.hypot(destX - agent.gx, destY - agent.gy) > 4.2;
    agent.waypoints = farApart
      ? [{ x: 5.6 + (Math.random() - 0.5) * 0.5, y: 4.8 + (Math.random() - 0.5) * 0.5 }, { x: destX, y: destY }]
      : [{ x: destX, y: destY }];
    agent.zone = zoneKey;
    agent.taskKey = taskKey;
    agent.stateKey = stateKey;
    agent.customTask = customTask || '';
    hydrateAgentText(agent);
    agent.timer = 4.2 + Math.random() * 3.2;
  }

  const SCENARIOS = {
    swarm: () => {
      sendAgentTo(agents[0], 'hub', 'coord', 'active');
      sendAgentTo(agents[1], 'coderB', 'arch', 'review');
      sendAgentTo(agents[2], 'coderA', 'coder', 'coding');
      sendAgentTo(agents[3], 'ssh', 'ssh', 'online');
      sendAgentTo(agents[4], 'vault', 'vault', 'sync');
      sendAgentTo(agents[5], 'qa', 'qa', 'testing');
      spawnPacket('hub', 'coderA', '#7557f6');
      spawnPacket('hub', 'ssh', '#10b981');
      spawnPacket('hub', 'vault', '#f59e0b');
    },
    release: () => {
      sendAgentTo(agents[0], 'qa', 'scRelease1', 'release');
      sendAgentTo(agents[2], 'coderA', 'coder', 'coding');
      sendAgentTo(agents[5], 'qa', 'scRelease2', 'testing');
      sendAgentTo(agents[1], 'hub', 'arch', 'review');
      sendAgentTo(agents[4], 'vault', 'scRelease3', 'sync');
      sendAgentTo(agents[3], 'lounge', 'lounge', 'standby');
      spawnPacket('coderA', 'qa', '#a78bfa');
      spawnPacket('qa', 'hub', '#fb7185');
    },
    ssh: () => {
      sendAgentTo(agents[3], 'ssh', 'scSsh1', 'online');
      sendAgentTo(agents[0], 'ssh', 'scSsh2', 'active');
      sendAgentTo(agents[4], 'vault', 'vault', 'sync');
      sendAgentTo(agents[2], 'coderB', 'coder', 'coding');
      sendAgentTo(agents[5], 'ssh', 'qa', 'testing');
      spawnPacket('hub', 'ssh', '#10b981');
      spawnPacket('ssh', 'vault', '#f59e0b');
    },
    db: () => {
      sendAgentTo(agents[4], 'vault', 'scDb1', 'sync');
      sendAgentTo(agents[1], 'vault', 'scDb2', 'review');
      sendAgentTo(agents[0], 'lounge', 'coordSync', 'active');
      sendAgentTo(agents[5], 'qa', 'qa', 'testing');
      spawnPacket('coderA', 'vault', '#f59e0b');
      spawnPacket('vault', 'hub', '#38bdf8');
    }
  };

  function autonomousTick(dt) {
    agents.forEach((a) => {
      if (a.waypoints.length > 0) {
        const wp = a.waypoints[0];
        const dx = wp.x - a.gx;
        const dy = wp.y - a.gy;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.08) {
          a.gx = wp.x;
          a.gy = wp.y;
          a.waypoints.shift();
        } else {
          a.gx += (dx / dist) * 1.65 * dt;
          a.gy += (dy / dist) * 1.65 * dt;
        }
        return;
      }

      a.timer -= dt;
      if (a.timer <= 0) {
        const r = Math.random();
        if (a.id === 'orchestrator') {
          const targets = ['hub', 'lounge', 'qa', 'coderA'];
          const z = targets[Math.floor(Math.random() * targets.length)];
          sendAgentTo(a, z, z === 'lounge' ? 'coordSync' : 'coord', 'active');
          spawnPacket('hub', z === 'hub' ? 'coderA' : z, a.color);
        } else if (r < 0.24) {
          sendAgentTo(a, 'lounge', 'lounge', 'discuss');
        } else {
          const homeMap = {
            architect: ['coderB', 'arch', 'review'],
            coder: ['coderA', 'coder', 'coding'],
            sshops: ['ssh', 'ssh', 'online'],
            memory: ['vault', 'vault', 'sync'],
            verifier: ['qa', 'qa', 'testing']
          };
          const [hz, tk, sk] = homeMap[a.id] || ['hub', 'coord', 'active'];
          const collab = r < 0.45 ? 'hub' : hz;
          sendAgentTo(a, collab, collab === 'hub' ? 'report' : tk, sk);
          spawnPacket(collab === 'hub' ? hz : 'hub', collab, a.color);
        }
        if (a.id === selectedAgentId) {
          window.dispatchEvent(new CustomEvent('giato:agent-updated', { detail: a }));
        }
      }
    });

    for (let i = packets.length - 1; i >= 0; i -= 1) {
      packets[i].t += packets[i].speed * dt;
      if (packets[i].t >= 1) packets.splice(i, 1);
    }
  }

  function drawFloorAndTracks(c) {
    drawIsoBox(0, 0, -0.35, GRID_W, GRID_H, 0.35, c.floorTop, c.floorEdgeL, c.floorEdgeR, c.gridLine);

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

    const routes = [
      ['hub', 'coderA'],
      ['hub', 'coderB'],
      ['hub', 'ssh'],
      ['hub', 'vault'],
      ['hub', 'qa']
    ];
    const zScale = baseZoom * userZoom;
    ctx.save();
    ctx.strokeStyle = c.fiber;
    ctx.lineWidth = 2 * zScale;
    ctx.setLineDash([5 * zScale, 5 * zScale]);
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

    const labels = t().zones;
    ctx.save();
    ctx.font = `600 ${Math.max(9, Math.round(9.5 * zScale))}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    Object.entries(ZONES).forEach(([k, z]) => {
      const p = iso(z.gx + 0.4, z.gy + 1.15, 0.02);
      ctx.fillStyle = c.zoneLabel;
      ctx.fillText(labels[k] || k.toUpperCase(), p.x, p.y);
    });
    ctx.restore();
  }

  function drawDeskWithMonitors(gx, gy, c, accentColor, phase) {
    drawIsoBox(gx, gy, 0, 1.5, 0.85, 0.72, c.deskTop, c.deskFront, c.deskSide, c.gridLine);
    drawIsoBox(gx + 0.2, gy + 0.16, 0.74, 0.48, 0.16, 0.54, '#393650', c.monitorFrame, '#181625', c.gridLine);
    drawIsoBox(gx + 0.82, gy + 0.16, 0.74, 0.48, 0.16, 0.54, '#393650', c.monitorFrame, '#181625', c.gridLine);

    const zScale = baseZoom * userZoom;
    const g1 = iso(gx + 0.44, gy + 0.24, 1.32);
    const g2 = iso(gx + 1.06, gy + 0.24, 1.32);
    [g1, g2].forEach((pt, idx) => {
      const alpha = 0.55 + 0.45 * Math.sin(simTime * 3.5 + phase + idx * 1.5);
      ctx.fillStyle = idx === 0 ? accentColor : `rgba(167, 139, 250, ${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.5 * zScale, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawServerRack(gx, gy, c) {
    drawIsoBox(gx, gy, 0, 0.9, 0.9, 1.95, '#3b3754', c.rackBody, c.rackSide, c.gridLine);
    const zScale = baseZoom * userZoom;
    const topLed = iso(gx + 0.45, gy + 0.45, 2.02);
    const blink = Math.sin(simTime * 5 + gx) > 0;
    ctx.fillStyle = blink ? '#4ade80' : '#8b68f6';
    ctx.beginPath();
    ctx.arc(topLed.x, topLed.y, 3.2 * zScale, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawVaultPlinth(gx, gy, c) {
    drawIsoBox(gx, gy, 0, 1.3, 1.3, 0.45, c.deskTop, c.deskFront, c.deskSide, c.gridLine);
    drawIsoBox(gx + 0.25, gy + 0.25, 0.45, 0.8, 0.8, 1.15, '#5034bd', '#2e2942', '#201c30', '#7557f6');
    const zScale = baseZoom * userZoom;
    const top = iso(gx + 0.65, gy + 0.65, 1.72 + Math.sin(simTime * 2.5) * 0.12);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.8 * zScale;
    ctx.beginPath();
    ctx.ellipse(top.x, top.y, 12 * zScale, 12 * zScale * pitch, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawWhiteboardLounge(gx, gy, c) {
    drawIsoBox(gx - 0.55, gy - 0.55, 0, 1.3, 0.22, 1.4, '#e2e0f0', '#ffffff', '#c8c4dc', c.gridLine);
    drawIsoBox(gx - 0.25, gy + 0.1, 0, 0.9, 0.9, 0.48, c.deskTop, c.deskFront, c.deskSide, c.gridLine);
  }

  function drawAgent(agent, c) {
    const zScale = baseZoom * userZoom;
    const walking = agent.waypoints.length > 0;
    const bob = walking ? Math.abs(Math.sin(simTime * 11)) * 0.14 : Math.sin(simTime * 2.4 + agent.gx) * 0.03;
    const base = iso(agent.gx, agent.gy, 0);

    const selected = agent.id === selectedAgentId;
    const hovered = agent.id === hoveredAgentId;
    if (selected || hovered) {
      ctx.save();
      ctx.strokeStyle = selected ? '#7557f6' : 'rgba(255,255,255,0.55)';
      ctx.lineWidth = (selected ? 2.4 : 1.4) * zScale;
      ctx.beginPath();
      ctx.ellipse(base.x, base.y, 18 * zScale, 18 * zScale * pitch, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, 11 * zScale, 11 * zScale * pitch, 0, 0, Math.PI * 2);
    ctx.fill();

    const bodyPos = iso(agent.gx, agent.gy, 0.12 + bob);
    const bodyH = 19 * zScale;
    const bodyW = 13 * zScale;

    ctx.fillStyle = '#252337';
    ctx.fillRect(bodyPos.x - 4.5 * zScale, bodyPos.y - 4 * zScale, 3.5 * zScale, 5 * zScale);
    ctx.fillRect(bodyPos.x + 1 * zScale, bodyPos.y - 4 * zScale, 3.5 * zScale, 5 * zScale);

    ctx.fillStyle = agent.color;
    ctx.beginPath();
    ctx.roundRect(bodyPos.x - bodyW * 0.5, bodyPos.y - bodyH, bodyW, bodyH - 3 * zScale, 5 * zScale);
    ctx.fill();

    const headY = bodyPos.y - bodyH - 9 * zScale;
    ctx.fillStyle = '#181625';
    ctx.beginPath();
    ctx.roundRect(bodyPos.x - 7.5 * zScale, headY, 15 * zScale, 11 * zScale, 5 * zScale);
    ctx.fill();
    ctx.strokeStyle = agent.color;
    ctx.lineWidth = 1.2 * zScale;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(bodyPos.x - 4.5 * zScale, headY + 4 * zScale, 9 * zScale, 2.3 * zScale);

    const labelY = headY - 12 * zScale;
    ctx.font = `600 ${Math.max(9.5, Math.round(10 * zScale))}px "JetBrains Mono", monospace`;
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

    const drawList = [
      { depth: depthOf(ZONES.hub.gx + 0.25, ZONES.hub.gy), draw: () => drawDeskWithMonitors(ZONES.hub.gx - 0.5, ZONES.hub.gy - 0.5, c, '#7557f6', 0.2) },
      { depth: depthOf(ZONES.coderA.gx + 0.25, ZONES.coderA.gy), draw: () => drawDeskWithMonitors(ZONES.coderA.gx - 0.4, ZONES.coderA.gy - 0.2, c, '#a78bfa', 1.5) },
      { depth: depthOf(ZONES.coderB.gx + 0.25, ZONES.coderB.gy), draw: () => drawDeskWithMonitors(ZONES.coderB.gx - 0.2, ZONES.coderB.gy - 0.4, c, '#38bdf8', 2.8) },
      { depth: depthOf(ZONES.ssh.gx - 0.15, ZONES.ssh.gy), draw: () => drawServerRack(ZONES.ssh.gx - 0.6, ZONES.ssh.gy - 0.4, c) },
      { depth: depthOf(ZONES.ssh.gx + 0.9, ZONES.ssh.gy), draw: () => drawServerRack(ZONES.ssh.gx + 0.45, ZONES.ssh.gy - 0.4, c) },
      { depth: depthOf(ZONES.vault.gx + 0.25, ZONES.vault.gy + 0.25), draw: () => drawVaultPlinth(ZONES.vault.gx - 0.4, ZONES.vault.gy - 0.4, c) },
      { depth: depthOf(ZONES.qa.gx + 0.15, ZONES.qa.gy + 0.6), draw: () => drawDeskWithMonitors(ZONES.qa.gx - 0.6, ZONES.qa.gy + 0.2, c, '#fb7185', 4.1) },
      { depth: depthOf(ZONES.lounge.gx, ZONES.lounge.gy), draw: () => drawWhiteboardLounge(ZONES.lounge.gx, ZONES.lounge.gy, c) }
    ];

    agents.forEach((agent) => {
      drawList.push({
        depth: depthOf(agent.gx, agent.gy) + 0.18,
        draw: () => drawAgent(agent, c)
      });
    });

    drawList.sort((a, b) => a.depth - b.depth);
    drawList.forEach((item) => item.draw());

    const zScale = baseZoom * userZoom;
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
      ctx.arc(pt.x, pt.y, 4 * zScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    width = Math.max(320, rect.width);
    height = Math.max(380, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    baseZoom = Math.max(0.75, Math.min(1.42, Math.min(width / 820, height / 430)));
  }

  let lastTs = performance.now();
  function frame(ts) {
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;

    // Smooth camera interpolation for rotation, tilt, and zoom
    const ease = 1 - Math.exp(-12 * dt);
    rotAngle += (targetRot - rotAngle) * ease;
    pitch += (targetPitch - pitch) * ease;
    userZoom += (targetZoom - userZoom) * ease;

    if (!paused) {
      simTime += dt;
      autonomousTick(dt);
    }
    render();
    requestAnimationFrame(frame);
  }

  function pickAgentAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const zScale = baseZoom * userZoom;
    let best = null;
    let bestDist = 34 * zScale;
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
    dragMode = e.shiftKey || e.button === 2 || e.button === 1 ? 'pan' : 'orbit';
    dragStart = { x: e.clientX, y: e.clientY, rot: targetRot, pitch: targetPitch, camX, camY, moved: false };
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    if (!dragging && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
      const hit = pickAgentAt(e.clientX, e.clientY);
      hoveredAgentId = hit ? hit.id : null;
      canvas.style.cursor = hit ? 'pointer' : 'grab';
    }
    if (!dragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    if (Math.hypot(dx, dy) > 4) dragStart.moved = true;

    if (dragMode === 'pan') {
      camX = Math.max(-240, Math.min(240, dragStart.camX + dx));
      camY = Math.max(-160, Math.min(160, dragStart.camY + dy));
    } else {
      targetRot = dragStart.rot + dx * 0.009;
      targetPitch = Math.max(0.32, Math.min(0.68, dragStart.pitch + dy * 0.0018));
    }
  });

  window.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    canvas.style.cursor = 'grab';
    if (!dragStart.moved) {
      const hit = pickAgentAt(e.clientX, e.clientY);
      if (hit) {
        selectAgent(hit.id);
      } else {
        const rect = canvas.getBoundingClientRect();
        const g = screenToGrid(e.clientX - rect.left, e.clientY - rect.top);
        if (g.gx >= 0.8 && g.gx <= GRID_W - 0.8 && g.gy >= 0.8 && g.gy <= GRID_H - 0.8) {
          const active = agents.find((a) => a.id === selectedAgentId);
          if (active) {
            active.waypoints = [{ x: g.gx, y: g.gy }];
            active.stateKey = 'active';
            active.customTask = currentLang === 'id'
              ? `Menuju (${g.gx.toFixed(1)}, ${g.gy.toFixed(1)})`
              : `Moving to (${g.gx.toFixed(1)}, ${g.gy.toFixed(1)})`;
            hydrateAgentText(active);
            window.dispatchEvent(new CustomEvent('giato:agent-updated', { detail: active }));
          }
        }
      }
    }
  });

  // Mouse wheel / trackpad pinch zoom directly on canvas
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.09 : 0.92;
      targetZoom = Math.max(0.55, Math.min(2.2, targetZoom * factor));
    },
    { passive: false }
  );

  function selectAgent(id) {
    selectedAgentId = id;
    const agent = agents.find((a) => a.id === id) || agents[0];
    window.dispatchEvent(new CustomEvent('giato:agent-selected', { detail: agent }));
  }

  window.GiatoOfficeSim = {
    getAgents: () => agents,
    getSelectedId: () => selectedAgentId,
    selectAgent,
    runScenario: (name) => {
      if (SCENARIOS[name]) SCENARIOS[name]();
      return name;
    },
    setLang: (lang) => {
      currentLang = lang === 'id' ? 'id' : 'en';
      agents.forEach(hydrateAgentText);
      const active = agents.find((a) => a.id === selectedAgentId);
      if (active) window.dispatchEvent(new CustomEvent('giato:agent-updated', { detail: active }));
    },
    rotateBy: (deg) => {
      targetRot += (deg * Math.PI) / 180;
    },
    zoomBy: (factor) => {
      targetZoom = Math.max(0.55, Math.min(2.2, targetZoom * factor));
    },
    togglePause: () => {
      paused = !paused;
      return paused;
    },
    resetView: () => {
      targetRot = 0;
      targetPitch = 0.5;
      targetZoom = 1;
      camX = 0;
      camY = 0;
    }
  };

  window.addEventListener('resize', resize);
  resize();
  SCENARIOS.swarm();
  requestAnimationFrame(frame);
})();
