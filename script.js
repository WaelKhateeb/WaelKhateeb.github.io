document.addEventListener('DOMContentLoaded', () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  /* ---------- Ambient gold constellation behind dark surfaces ---------- */
  (function ambientField() {
    const hosts = document.querySelectorAll('.page-banner, .section-dark, .site-footer');
    if (!hosts.length) return;
    const LINK2 = 17000; // squared link distance (~130px)
    // Machine-learning / data-science tokens that drift through the background
    const GLYPHS = ['∇L', 'Σ wᵢxᵢ', 'σ(z)', 'ŷ = Wx + b', '∂L/∂w', 'softmax', 'ReLU', 'P(y|x)',
      'argmax', 'μ, σ²', 'θ', 'λ', 'SVD', 'k-NN', 'βᵀx', 'f(x; θ)', '[ A | b ]', '∇·F', 'tanh',
      'gradient', 'tensor', 'loss ↓', '01001010', 'E[X]', 'KL(p‖q)'];
    const fields = [];
    const randGlyph = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];

    const sizeField = (f) => {
      const r = f.host.getBoundingClientRect();
      f.w = r.width; f.h = r.height;
      f.c.width = f.w * f.dpr; f.c.height = f.h * f.dpr;
      f.ctx.setTransform(f.dpr, 0, 0, f.dpr, 0, 0);
      const count = Math.max(12, Math.min(60, Math.round((f.w * f.h) / 18000)));
      f.pts = [];
      for (let i = 0; i < count; i++) {
        f.pts.push({
          x: Math.random() * f.w, y: Math.random() * f.h,
          vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22,
          r: 0.8 + Math.random() * 1.6
        });
      }
      const gcount = Math.max(2, Math.min(8, Math.round((f.w * f.h) / 95000)));
      f.glyphs = [];
      for (let i = 0; i < gcount; i++) {
        f.glyphs.push({
          x: Math.random() * f.w, y: Math.random() * f.h,
          vy: -(0.07 + Math.random() * 0.12), sway: Math.random() * Math.PI * 2,
          size: 12 + Math.random() * 14, a: 0.05 + Math.random() * 0.07, text: randGlyph()
        });
      }
    };

    const drawField = (f) => {
      const { ctx, w, h, pts } = f;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK2) {
            ctx.strokeStyle = `rgba(196,150,28,${(1 - d2 / LINK2) * 0.26})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
          }
        }
      }
      for (const p of pts) {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(244,197,66,0.55)'; ctx.fill();
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
});
