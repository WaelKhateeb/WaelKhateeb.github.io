document.addEventListener('DOMContentLoaded', () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Analytics (Google Analytics 4) + event tracking ----------
     Paste your GA4 Measurement ID below (looks like G-ABCD1234). Until then
     analytics stays dormant but the page works normally. Once set, the site
     records page views automatically plus: PDF downloads, outbound link
     clicks, and contact-form submissions. */
  const GA_MEASUREMENT_ID = 'G-V5EVW5VW9Y';
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
    const TAU = Math.PI * 2;
    const fields = [];
    // deterministic per-page seed so each page carries its own coherent vector field
    let seed = 0; for (const ch of (location.pathname || '/')) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const sd = (seed % 1000) / 1000;
    const K1 = 0.0017 + sd * 0.0013, K2 = 0.0012 + (1 - sd) * 0.0013, K3 = 0.0007 + sd * 0.0006, PH = sd * TAU;
    let T = 0;                                  // slow global time → the field gently "breathes"
    const angleAt = (x, y) => Math.sin(x * K1 + PH + T) + Math.cos(y * K2 - T * 0.7) + 0.6 * Math.sin((x + y) * K3 + T * 0.5);
    const vel = (x, y) => { const a = angleAt(x, y) * Math.PI; return [Math.cos(a), Math.sin(a)]; };
    const GOLD = '187,141,10', GOLD_HI = '244,197,66', CYAN = '120,196,214';

    // (legacy ML motifs removed — the background is now the vector-field system below)

    const spawn = (f, anywhere) => ({
      x: Math.random() * f.w,
      y: anywhere ? Math.random() * f.h : (Math.random() < 0.5 ? -8 : f.h + 8),
      trail: [], life: 0, max: 120 + Math.random() * 170,
      accent: Math.random() < 0.12, lw: 0.7 + Math.random() * 1.1, sp: 0.7 + Math.random() * 0.7
    });

    const drawDirField = (f) => {              // a slope / direction field — quintessential ODE imagery
      const { ctx, grid } = f, L = grid * 0.42;
      ctx.lineWidth = 1; ctx.lineCap = 'round'; ctx.strokeStyle = `rgba(${GOLD},0.10)`;
      for (let gx = grid * 0.5; gx < f.w; gx += grid)
        for (let gy = grid * 0.5; gy < f.h; gy += grid) {
          const [vx, vy] = vel(gx, gy);
          ctx.beginPath();
          ctx.moveTo(gx - vx * L * 0.5, gy - vy * L * 0.5);
          ctx.lineTo(gx + vx * L * 0.5, gy + vy * L * 0.5);
          ctx.stroke();
        }
    };

    const sizeField = (f) => {
      const r = f.host.getBoundingClientRect();
      f.w = r.width; f.h = r.height;
      f.c.width = f.w * f.dpr; f.c.height = f.h * f.dpr;
      f.ctx.setTransform(f.dpr, 0, 0, f.dpr, 0, 0);
      f.grid = Math.max(42, Math.min(72, Math.round(Math.min(f.w, f.h) / 8)));
      const n = Math.max(12, Math.min(120, Math.round((f.w * f.h) / 8000)));
      f.parts = []; for (let i = 0; i < n; i++) f.parts.push(spawn(f, true));
    };

    const drawField = (f) => {
      const { ctx, w, h } = f;
      ctx.clearRect(0, 0, w, h);
      drawDirField(f);
      ctx.lineCap = 'round';
      for (const p of f.parts) {
        const t = p.trail, fade = 1 - p.life / p.max;
        for (let i = 1; i < t.length; i++) {
          const a = (i / t.length) * fade * 0.55;
          ctx.strokeStyle = p.accent ? `rgba(${CYAN},${a})` : `rgba(${GOLD_HI},${a})`;
          ctx.lineWidth = p.lw * (i / t.length) + 0.2;
          ctx.beginPath(); ctx.moveTo(t[i - 1].x, t[i - 1].y); ctx.lineTo(t[i].x, t[i].y); ctx.stroke();
        }
        if (t.length) {
          const head = t[t.length - 1];
          ctx.beginPath(); ctx.arc(head.x, head.y, p.lw + 0.6, 0, TAU);
          ctx.fillStyle = p.accent ? `rgba(190,228,240,${fade * 0.9})` : `rgba(255,231,150,${fade * 0.9})`;
          ctx.shadowColor = p.accent ? `rgba(${CYAN},0.85)` : `rgba(${GOLD_HI},0.85)`;
          ctx.shadowBlur = 7 * fade; ctx.fill(); ctx.shadowBlur = 0;
        }
      }
    };

    const stepField = (f) => {
      for (let i = 0; i < f.parts.length; i++) {
        const p = f.parts[i];
        const [vx, vy] = vel(p.x, p.y);
        p.x += vx * p.sp; p.y += vy * p.sp; p.life++;
        p.trail.push({ x: p.x, y: p.y }); if (p.trail.length > 18) p.trail.shift();
        if (p.life > p.max || p.x < -14 || p.x > f.w + 14 || p.y < -14 || p.y > f.h + 14) f.parts[i] = spawn(f, false);
      }
      T += 0.0008;
    };

    hosts.forEach((host) => {
      const c = document.createElement('canvas');
      c.className = 'bg-canvas'; c.setAttribute('aria-hidden', 'true');
      host.insertBefore(c, host.firstChild);
      const f = { host, c, ctx: c.getContext('2d'), dpr: Math.min(window.devicePixelRatio || 1, 2), w: 0, h: 0, pts: [], visible: true };
      sizeField(f); fields.push(f);
    });

    fields.forEach(drawField);            // paint an initial frame at once (also covers throttled/paused rAF)
    if (!reduceMotion) {
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
