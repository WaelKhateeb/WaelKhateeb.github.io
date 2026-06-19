document.addEventListener('DOMContentLoaded', () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Analytics (Google Analytics 4) + event tracking ----------
     Paste your GA4 Measurement ID below (looks like G-ABCD1234). Until then
     analytics stays dormant but the page works normally. Once set, the site
     records page views automatically plus: PDF downloads, outbound link
     clicks, and contact-form submissions. */
  const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX';
  (function analytics() {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    const live = /^G-[A-Z0-9]{6,}$/.test(GA_MEASUREMENT_ID);
    if (live) {
      const s = document.createElement('script');
      s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
      document.head.appendChild(s);
      gtag('js', new Date());
      gtag('config', GA_MEASUREMENT_ID, { anonymize_ip: true });
    }
    const track = (name, params) => {
      try { gtag('event', name, params || {}); } catch (e) {}
      if (!live) console.debug('[analytics]', name, params || {});
    };
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a) return;
      let url; try { url = new URL(a.href, location.href); } catch (_) { return; }
      if (/\.pdf(\?|$)/i.test(url.pathname)) {
        track('file_download', { file_name: decodeURIComponent(url.pathname.split('/').pop()), file_extension: 'pdf', link_url: url.href });
      } else if (url.host && url.host !== location.host) {
        track('outbound_click', { link_url: url.href, link_domain: url.host, link_text: (a.textContent || '').trim().slice(0, 80) });
      }
    }, true);
    const cf = document.querySelector('.contact-form');
    if (cf) cf.addEventListener('submit', () => track('contact_submit', { method: 'formsubmit' }));
  })();

  /* ---------- Mobile menu ---------- */
  const menu = document.querySelector('.menu-button');
  const nav = document.querySelector('.primary-nav');
  if (menu && nav) {
    menu.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open');
      menu.setAttribute('aria-expanded', String(isOpen));
    });
    nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      nav.classList.remove('open');
      menu.setAttribute('aria-expanded', 'false');
    }));
  }

  /* ---------- Footer year ---------- */
  document.querySelectorAll('#year').forEach((y) => { y.textContent = new Date().getFullYear(); });

  /* ---------- Scroll progress bar + header state ---------- */
  const bar = document.querySelector('.scroll-progress');
  const header = document.querySelector('.site-header');
  const onScroll = () => {
    const h = document.documentElement;
    const scrolled = h.scrollTop;
    if (bar) {
      const max = h.scrollHeight - h.clientHeight;
      bar.style.width = (max > 0 ? (scrolled / max) * 100 : 0) + '%';
    }
    if (header) header.classList.toggle('scrolled', scrolled > 12);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Scroll reveal ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealEls.forEach((el) => el.classList.add('in'));
    } else {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
      revealEls.forEach((el) => io.observe(el));
    }
  }

  /* ---------- Count-up stats ---------- */
  const counters = document.querySelectorAll('[data-count]');
  const runCount = (el) => {
    const target = parseFloat(el.getAttribute('data-count')) || 0;
    const suffix = el.getAttribute('data-suffix') || '';
    if (reduceMotion) { el.textContent = target + suffix; return; }
    const dur = 1500; const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if (counters.length) {
    if (!('IntersectionObserver' in window)) {
      counters.forEach(runCount);
    } else {
      const cio = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) { runCount(e.target); cio.unobserve(e.target); } });
      }, { threshold: 0.5 });
      counters.forEach((el) => cio.observe(el));
    }
  }

  /* ---------- Live predator–prey phase portrait ---------- */
  const canvas = document.getElementById('phase-canvas');
  if (canvas && canvas.getContext) {
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Lotka–Volterra: x' = a x - b xy ,  y' = -c y + d xy  (equilibrium at (c/d, a/b))
    const A = 1, B = 1, C = 1, D = 1;
    const deriv = (x, y) => [A * x - B * x * y, -C * y + D * x * y];
    const rk4 = (x, y, dt) => {
      const [k1x, k1y] = deriv(x, y);
      const [k2x, k2y] = deriv(x + 0.5 * dt * k1x, y + 0.5 * dt * k1y);
      const [k3x, k3y] = deriv(x + 0.5 * dt * k2x, y + 0.5 * dt * k2y);
      const [k4x, k4y] = deriv(x + dt * k3x, y + dt * k3y);
      return [x + dt / 6 * (k1x + 2 * k2x + 2 * k3x + k4x), y + dt / 6 * (k1y + 2 * k2y + 2 * k3y + k4y)];
    };
    // Build one closed orbit starting at (x0,1), integrate until it crosses y=1 (x>1) going upward again.
    const buildOrbit = (x0) => {
      const pts = []; let x = x0, y = 1; const dt = 0.012; let prevY = y; let steps = 0;
      while (steps < 60000) {
        pts.push([x, y]);
        const [nx, ny] = rk4(x, y, dt);
        if (steps > 50 && prevY < 1 && ny >= 1 && nx > 1) { pts.push([nx, ny]); break; }
        prevY = y; x = nx; y = ny; steps++;
      }
      return pts;
    };

    const orbits = [0.35, 0.7, 1.1, 1.55, 2.05].map((r) => ({
      pts: buildOrbit(1 + r),
      head: Math.random(),                 // particle position (0..1 along orbit)
      speed: 0.00035 + Math.random() * 0.0002
    }));

    // Phase-space bounds for mapping
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    orbits.forEach((o) => o.pts.forEach(([x, y]) => {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }));
    const padX = (maxX - minX) * 0.12, padY = (maxY - minY) * 0.12;
    minX -= padX; maxX += padX; minY -= padY; maxY += padY;

    let scale = 1, offX = 0, offY = 0, cx = 0, cy = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      W = rect.width; H = rect.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // fit the portrait into a square region, anchored toward the right on wide screens
      const region = Math.min(W, H) * 0.92;
      scale = region / Math.max(maxX - minX, maxY - minY);
      cx = W > 760 ? W * 0.7 : W * 0.5;
      cy = H * 0.5;
      offX = cx - ((minX + maxX) / 2) * scale;
      offY = cy + ((minY + maxY) / 2) * scale;
    };
    const mapX = (x) => x * scale + offX;
    const mapY = (y) => offY - y * scale;
    resize();
    window.addEventListener('resize', () => { dpr = Math.min(window.devicePixelRatio || 1, 2); resize(); }, { passive: true });

    const drawStatic = () => {
      ctx.clearRect(0, 0, W, H);
      orbits.forEach((o) => {
        ctx.beginPath();
        o.pts.forEach(([x, y], i) => { const px = mapX(x), py = mapY(y); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
        ctx.strokeStyle = 'rgba(187,141,10,0.28)'; ctx.lineWidth = 1.1; ctx.stroke();
      });
    };

    if (reduceMotion) { drawStatic(); }
    else {
      const render = () => {
        ctx.clearRect(0, 0, W, H);
        // faint full orbits
        orbits.forEach((o) => {
          ctx.beginPath();
          o.pts.forEach(([x, y], i) => { const px = mapX(x), py = mapY(y); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
          ctx.strokeStyle = 'rgba(187,141,10,0.16)'; ctx.lineWidth = 1; ctx.stroke();
        });
        // glowing comet trails
        orbits.forEach((o) => {
          const n = o.pts.length; const trail = Math.floor(n * 0.16);
          const headIdx = Math.floor(o.head * n) % n;
          for (let k = trail; k >= 0; k--) {
            const idx = (headIdx - k + n) % n;
            const [x, y] = o.pts[idx];
            const t = 1 - k / trail;
            ctx.beginPath();
            ctx.arc(mapX(x), mapY(y), 0.6 + t * 2.2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(244,197,66,${0.05 + t * 0.55})`;
            ctx.fill();
          }
          const [hx, hy] = o.pts[headIdx];
          ctx.beginPath(); ctx.arc(mapX(hx), mapY(hy), 3.4, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,231,150,0.95)'; ctx.shadowColor = 'rgba(244,197,66,0.9)'; ctx.shadowBlur = 14; ctx.fill(); ctx.shadowBlur = 0;
          o.head = (o.head + o.speed) % 1;
        });
        // equilibrium point with pulse
        const pulse = 3 + Math.sin(performance.now() / 600) * 1.4;
        ctx.beginPath(); ctx.arc(mapX(C / D), mapY(A / B), pulse, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(244,197,66,0.85)'; ctx.shadowColor = 'rgba(244,197,66,0.8)'; ctx.shadowBlur = 16; ctx.fill(); ctx.shadowBlur = 0;
        requestAnimationFrame(render);
      };
      requestAnimationFrame(render);
    }
  }

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- Ambient field: neural nets + DNA helices + data constellation ---------- */
  (function ambientField() {
    const hosts = document.querySelectorAll('.page-banner, .section-dark, .site-footer');
    if (!hosts.length) return;
    const LINK2 = 17000; // squared link distance (~130px)
    // Machine-learning + mathematical-biology tokens that drift through the background
    const GLYPHS = ['∇L', 'σ(z)', 'ŷ = Wx + b', '∂L/∂w', 'softmax', 'ReLU', 'P(y|x)',
      'argmax', 'θ', 'λ', 'SVD', 'tanh', 'loss ↓', '01001010', 'KL(p‖q)',
      "x' = αx − βxy", 'dS/dt', 'R₀', 'A·C·G·T', 'Δu = f(u)', 'Hopf', 'τ-delay'];
    const fields = [];
    const randGlyph = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];

    /* --- Neural-network motif: layered nodes with signals firing along edges (ML) --- */
    const makeNet = (w, h) => {
      const layouts = [[3, 4, 3], [2, 4, 3], [3, 3, 3], [2, 3, 4, 2]];
      const layers = layouts[(Math.random() * layouts.length) | 0];
      const lw = 52, lh = 30;
      const width = (layers.length - 1) * lw, height = (Math.max.apply(null, layers) - 1) * lh;
      const ox = 24 + Math.random() * Math.max(1, w - width - 48);
      const oy = 24 + Math.random() * Math.max(1, h - height - 48);
      const nodes = layers.map((n, li) => {
        const top = oy + (height - (n - 1) * lh) / 2;
        return Array.from({ length: n }, (_, i) => ({ x: ox + li * lw, y: top + i * lh, glow: 0 }));
      });
      const edges = [];
      for (let li = 0; li < nodes.length - 1; li++)
        nodes[li].forEach((a) => nodes[li + 1].forEach((b) => edges.push({ a, b })));
      const net = { nodes, edges, pulses: [] };
      net.spawn = () => net.pulses.push({ e: edges[(Math.random() * edges.length) | 0], t: 0, speed: 0.012 + Math.random() * 0.02 });
      for (let i = 0; i < 4; i++) net.spawn();
      return net;
    };
    const stepNet = (net) => {
      net.nodes.forEach((col) => col.forEach((n) => { n.glow *= 0.92; }));
      for (let i = net.pulses.length - 1; i >= 0; i--) {
        const p = net.pulses[i]; p.t += p.speed;
        if (p.t >= 1) {
          p.e.b.glow = 1;
          const nxt = net.edges.filter((e) => e.a === p.e.b);
          if (nxt.length) { p.e = nxt[(Math.random() * nxt.length) | 0]; p.t = 0; }
          else { net.pulses.splice(i, 1); net.spawn(); }
        }
      }
    };
    const drawNet = (ctx, net) => {
      ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(187,141,10,0.10)';
      net.edges.forEach((e) => { ctx.beginPath(); ctx.moveTo(e.a.x, e.a.y); ctx.lineTo(e.b.x, e.b.y); ctx.stroke(); });
      net.pulses.forEach((p) => {
        const x = p.e.a.x + (p.e.b.x - p.e.a.x) * p.t, y = p.e.a.y + (p.e.b.y - p.e.a.y) * p.t;
        ctx.strokeStyle = 'rgba(244,197,66,0.45)'; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(p.e.a.x, p.e.a.y); ctx.lineTo(x, y); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,231,150,0.85)'; ctx.fill();
      });
      net.nodes.forEach((col) => col.forEach((n) => {
        const r = 2.5 + n.glow * 2.4;
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(244,197,66,${0.26 + n.glow * 0.6})`;
        if (n.glow > 0.05) { ctx.shadowColor = 'rgba(244,197,66,0.85)'; ctx.shadowBlur = 11 * n.glow; }
        ctx.fill(); ctx.shadowBlur = 0;
      }));
    };

    /* --- DNA double-helix motif drifting upward (biology) --- */
    const makeHelix = (w, h) => ({
      x: 24 + Math.random() * (w - 48), y: Math.random() * h,
      len: 110 + Math.random() * 120, amp: 8 + Math.random() * 6,
      freq: 0.13 + Math.random() * 0.05, phase: Math.random() * Math.PI * 2,
      speed: 0.12 + Math.random() * 0.18, rot: 0.012 + Math.random() * 0.01
    });
    const stepHelix = (he, h) => { he.y -= he.speed; he.phase += he.rot; if (he.y + he.len < -10) he.y = h + 10; };
    const drawHelix = (ctx, he) => {
      const pts = [];
      for (let s = 0; s <= he.len; s += 7) {
        const ang = s * he.freq + he.phase;
        pts.push({ ax: he.x + Math.sin(ang) * he.amp, bx: he.x + Math.sin(ang + Math.PI) * he.amp, y: he.y + s, c: Math.cos(ang) });
      }
      ctx.lineWidth = 1.2;
      for (let i = 1; i < pts.length; i++) {
        ctx.strokeStyle = 'rgba(196,150,28,0.20)'; ctx.beginPath(); ctx.moveTo(pts[i - 1].ax, pts[i - 1].y); ctx.lineTo(pts[i].ax, pts[i].y); ctx.stroke();
        ctx.strokeStyle = 'rgba(244,197,66,0.15)'; ctx.beginPath(); ctx.moveTo(pts[i - 1].bx, pts[i - 1].y); ctx.lineTo(pts[i].bx, pts[i].y); ctx.stroke();
      }
      for (let i = 0; i < pts.length; i += 2) {
        const p = pts[i];
        ctx.strokeStyle = `rgba(187,141,10,${0.05 + Math.abs(p.c) * 0.12})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.ax, p.y); ctx.lineTo(p.bx, p.y); ctx.stroke();
        ctx.fillStyle = 'rgba(244,197,66,0.4)';
        ctx.beginPath(); ctx.arc(p.ax, p.y, 1.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(p.bx, p.y, 1.4, 0, Math.PI * 2); ctx.fill();
      }
    };

    const sizeField = (f) => {
      const r = f.host.getBoundingClientRect();
      f.w = r.width; f.h = r.height;
      f.c.width = f.w * f.dpr; f.c.height = f.h * f.dpr;
      f.ctx.setTransform(f.dpr, 0, 0, f.dpr, 0, 0);
      const count = Math.max(10, Math.min(52, Math.round((f.w * f.h) / 20000)));
      f.pts = [];
      for (let i = 0; i < count; i++) {
        f.pts.push({
          x: Math.random() * f.w, y: Math.random() * f.h,
          vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22,
          r: 0.8 + Math.random() * 1.6
        });
      }
      const gcount = Math.max(2, Math.min(6, Math.round((f.w * f.h) / 130000)));
      f.glyphs = [];
      for (let i = 0; i < gcount; i++) {
        f.glyphs.push({
          x: Math.random() * f.w, y: Math.random() * f.h,
          vy: -(0.07 + Math.random() * 0.12), sway: Math.random() * Math.PI * 2,
          size: 12 + Math.random() * 13, a: 0.05 + Math.random() * 0.07, text: randGlyph()
        });
      }
      const netCount = (f.w > 640 && f.h > 240) ? Math.max(1, Math.round(f.w / 1000)) : (f.h > 320 ? 1 : 0);
      f.nets = []; for (let i = 0; i < netCount; i++) f.nets.push(makeNet(f.w, f.h));
      const helixCount = (f.h > 280) ? Math.max(1, Math.round(f.w / 1200)) : 0;
      f.helices = []; for (let i = 0; i < helixCount; i++) f.helices.push(makeHelix(f.w, f.h));
    };

    const drawField = (f) => {
      const { ctx, w, h, pts } = f;
      ctx.clearRect(0, 0, w, h);
      f.helices.forEach((he) => drawHelix(ctx, he));
      f.nets.forEach((net) => drawNet(ctx, net));
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK2) {
            ctx.strokeStyle = `rgba(196,150,28,${(1 - d2 / LINK2) * 0.24})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
          }
        }
      }
      for (const p of pts) {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(244,197,66,0.5)'; ctx.fill();
      }
      ctx.textBaseline = 'middle';
      for (const g of f.glyphs) {
        ctx.font = `600 ${g.size}px "IBM Plex Mono", ui-monospace, monospace`;
        ctx.fillStyle = `rgba(196,150,28,${g.a})`;
        ctx.fillText(g.text, g.x + Math.sin(g.sway) * 9, g.y);
      }
    };

    const stepField = (f) => {
      for (const p of f.pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < -10) p.x = f.w + 10; else if (p.x > f.w + 10) p.x = -10;
        if (p.y < -10) p.y = f.h + 10; else if (p.y > f.h + 10) p.y = -10;
      }
      for (const g of f.glyphs) {
        g.y += g.vy; g.sway += 0.008;
        if (g.y < -24) { g.y = f.h + 24; g.x = Math.random() * f.w; g.text = randGlyph(); }
      }
      f.nets.forEach(stepNet);
      f.helices.forEach((he) => stepHelix(he, f.h));
    };

    hosts.forEach((host) => {
      const c = document.createElement('canvas');
      c.className = 'bg-canvas'; c.setAttribute('aria-hidden', 'true');
      host.insertBefore(c, host.firstChild);
      const f = { host, c, ctx: c.getContext('2d'), dpr: Math.min(window.devicePixelRatio || 1, 2), w: 0, h: 0, pts: [], visible: true };
      sizeField(f); fields.push(f);
    });

    if (reduceMotion) {
      fields.forEach(drawField);
    } else {
      const loop = () => {
        for (const f of fields) { if (f.visible) { stepField(f); drawField(f); } }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      if ('IntersectionObserver' in window) {
        const vio = new IntersectionObserver((entries) => {
          entries.forEach((e) => { const f = fields.find((x) => x.host === e.target); if (f) f.visible = e.isIntersecting; });
        }, { threshold: 0 });
        fields.forEach((f) => vio.observe(f.host));
      }
    }

    let rt;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => fields.forEach((f) => { f.dpr = Math.min(window.devicePixelRatio || 1, 2); sizeField(f); if (reduceMotion) drawField(f); }), 160);
    }, { passive: true });
  })();

  /* ---------- Hero pointer parallax ---------- */
  if (!reduceMotion && finePointer) {
    const hero = document.querySelector('.home-page .hero');
    if (hero) {
      const orbs = hero.querySelector('.hero-orbs');
      const shot = hero.querySelector('.headshot-frame');
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        if (orbs) orbs.style.transform = `translate3d(${nx * 28}px, ${ny * 22}px, 0)`;
        if (shot) shot.style.transform = `translate3d(${nx * -14}px, ${ny * -10}px, 0)`;
      });
      hero.addEventListener('pointerleave', () => {
        if (orbs) orbs.style.transform = '';
        if (shot) shot.style.transform = '';
      });
    }
  }

  /* ---------- 3D card tilt ---------- */
  if (!reduceMotion && finePointer) {
    const tiltEls = document.querySelectorAll('.focus-card, .affiliation-card, .profile-links a, .teaching-group');
    tiltEls.forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(900px) rotateX(${ny * -5.5}deg) rotateY(${nx * 5.5}deg) translateY(-6px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------- News & updates rail: arrows + drag-to-scroll ---------- */
  (function newsRail() {
    const rail = document.querySelector('.news-rail');
    if (!rail) return;
    const prev = document.querySelector('.news-arrow.prev');
    const next = document.querySelector('.news-arrow.next');
    const step = () => { const c = rail.querySelector('.news-card'); return (c ? c.offsetWidth + 22 : 360); };
    const update = () => {
      const max = rail.scrollWidth - rail.clientWidth - 4;
      if (prev) prev.hidden = rail.scrollLeft < 8;
      if (next) next.hidden = rail.scrollLeft > max;
    };
    if (prev) prev.addEventListener('click', () => rail.scrollBy({ left: -step(), behavior: 'smooth' }));
    if (next) next.addEventListener('click', () => rail.scrollBy({ left: step(), behavior: 'smooth' }));
    rail.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
    // drag-to-scroll (desktop), without breaking link clicks
    if (finePointer) {
      let down = false, moved = false, sx = 0, sl = 0;
      rail.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; down = true; moved = false; sx = e.clientX; sl = rail.scrollLeft; rail.classList.add('grabbing'); });
      document.addEventListener('pointermove', (e) => { if (!down) return; const dx = e.clientX - sx; if (Math.abs(dx) > 6) moved = true; rail.scrollLeft = sl - dx; });
      document.addEventListener('pointerup', () => { down = false; rail.classList.remove('grabbing'); });
      rail.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
    }
  })();
});
