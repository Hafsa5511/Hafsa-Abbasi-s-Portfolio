/* ═══════════════════════════════════════════════════════
   SKY CONFIG — tweak the celestial background here
   ═══════════════════════════════════════════════════════ */
const SKY = {
  starCount: { desktop: 240, mobile: 110 },   // density
  mobileBreakpoint: 760,

  // Parallax layers: share of stars, scroll speed, size and brightness ranges
  layers: [
    { share: .55, speed: .03, size: [.35, .75], alpha: [.18, .45] },  // far
    { share: .32, speed: .08, size: [.55, 1.0], alpha: [.30, .60] },  // middle
    { share: .13, speed: .16, size: [.85, 1.4], alpha: [.45, .80] },  // near
  ],
  twinkleShare: .35,            // fraction of stars that twinkle
  twinkleSpeed: [.35, 1.1],     // radians per second (lower = gentler)
  scrollEase: .08,              // how softly stars follow the scroll

  // Star tints: [r, g, b, weight]
  tints: [[239, 223, 210, .72], [215, 195, 155, .18], [201, 138, 134, .10]],

  shootingStar: {
    enabled: true,
    delay: [9000, 22000],       // ms between shooting stars (random in range)
    duration: [900, 1400],      // ms
    length: [70, 130],          // trail length in px
    colour: [239, 223, 210],
    maxAlpha: .55,
  },

  constellations: {
    enabled: true,
    fadeIn: 4000, hold: 7000, fadeOut: 4500,   // ms
    gap: [2500, 6500],                          // ms between constellations
    size: { desktop: 170, mobile: 110 },        // px
    starColour: [215, 195, 155],  lineColour: [201, 138, 134],
    starAlpha: .7, lineAlpha: .28,
    // Where they may appear (fractions of the viewport). Kept to the edges so they sit away from text.
    slots: [{ x: .1, y: .26 }, { x: .88, y: .2 }, { x: .9, y: .62 }, { x: .08, y: .7 }, { x: .82, y: .86 }, { x: .14, y: .48 }],
    // Shapes: points in a 0–1 box, lines are index pairs
    shapes: [
      { name: 'Cassiopeia', points: [[0,.2],[.25,.75],[.5,.35],[.75,.85],[1,.3]], lines: [[0,1],[1,2],[2,3],[3,4]] },
      { name: 'Cygnus',     points: [[.5,0],[.5,.45],[.5,1],[.05,.32],[.95,.55]], lines: [[0,1],[1,2],[3,1],[1,4]] },
      { name: 'Corona',     points: [[0,.3],[.18,.7],[.4,.92],[.62,.9],[.82,.65],[1,.25]], lines: [[0,1],[1,2],[2,3],[3,4],[4,5]] },
      { name: 'Lyra',       points: [[.5,0],[.32,.38],[.7,.42],[.24,1],[.64,1]], lines: [[0,1],[0,2],[1,2],[1,3],[2,4],[3,4]] },
      { name: 'Dipper',     points: [[0,.1],[.2,.24],[.38,.34],[.55,.46],[.6,.82],[.95,.86],[.92,.48]], lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,3]] },
    ],
  },
};

/* ═══════════════════════════════════════════════════════
   SKY ENGINE — canvas starfield, shooting stars, constellations
   ═══════════════════════════════════════════════════════ */
(function sky() {
  const canvas = document.getElementById('sky');
  const ctx = canvas.getContext('2d');
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  let W = 0, H = 0, dpr = 1, stars = [], raf = null, last = 0;
  let scrollSmooth = window.scrollY;
  let shoot = null, nextShootAt = 0;
  let constel = null, nextConstelAt = 0, lastSlot = -1;

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const isMobile = () => window.innerWidth < SKY.mobileBreakpoint;
  const easeInOut = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  function pickTint() {
    let r = Math.random(), acc = 0;
    for (const t of SKY.tints) { acc += t[3]; if (r <= acc) return t; }
    return SKY.tints[0];
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const total = isMobile() ? SKY.starCount.mobile : SKY.starCount.desktop;
    stars = [];
    SKY.layers.forEach((L, li) => {
      const n = Math.round(total * L.share);
      for (let i = 0; i < n; i++) {
        const t = pickTint();
        stars.push({
          layer: li, x: Math.random() * W, y: Math.random() * (H + 40),
          r: rand(L.size[0], L.size[1]), a: rand(L.alpha[0], L.alpha[1]),
          rgb: `${t[0]},${t[1]},${t[2]}`,
          twinkle: Math.random() < SKY.twinkleShare,
          phase: Math.random() * Math.PI * 2, tws: rand(SKY.twinkleSpeed[0], SKY.twinkleSpeed[1]),
        });
      }
    });
  }

  /* — stars — */
  function drawStars(now, still) {
    const span = H + 40;
    for (const s of stars) {
      const L = SKY.layers[s.layer];
      let y = still ? s.y : ((s.y - scrollSmooth * L.speed) % span + span) % span;
      y -= 20;
      let a = s.a;
      if (s.twinkle && !still) a *= .7 + .3 * Math.sin(s.phase + now / 1000 * s.tws);
      ctx.fillStyle = `rgba(${s.rgb},${a})`;
      ctx.beginPath(); ctx.arc(s.x, y, s.r, 0, Math.PI * 2); ctx.fill();
      if (s.layer === 2) {                // soft halo on the nearest stars only
        ctx.fillStyle = `rgba(${s.rgb},${a * .08})`;
        ctx.beginPath(); ctx.arc(s.x, y, s.r * 3.2, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  /* — shooting stars (one at a time) — */
  function spawnShootingStar(now, origin) {
    const c = SKY.shootingStar;
    const dir = origin ? (origin.x > W / 2 ? -1 : 1) : (Math.random() < .5 ? 1 : -1);
    const angle = rand(22, 38) * Math.PI / 180;
    shoot = {
      x: origin ? origin.x : rand(W * .15, W * .85), y: origin ? origin.y : rand(H * .05, H * .4),
      dx: Math.cos(angle) * dir, dy: Math.sin(angle),
      dist: origin ? W * .38 : rand(W * .18, W * .3),
      len: origin ? 170 : rand(c.length[0], c.length[1]),
      dur: origin ? 1700 : rand(c.duration[0], c.duration[1]),
      alpha: origin ? .85 : c.maxAlpha,
      start: now,
    };
  }
  // used by the planet easter egg
  window.wishOnStar = (x, y) => {
    if (motionQuery.matches || !SKY.shootingStar.enabled) return;
    spawnShootingStar(performance.now(), { x, y });
  };
  function drawShootingStar(now) {
    const c = SKY.shootingStar;
    const t = (now - shoot.start) / shoot.dur;
    if (t >= 1) { shoot = null; nextShootAt = now + rand(c.delay[0], c.delay[1]); return; }
    const p = 1 - Math.pow(1 - t, 3);                         // ease-out travel
    const fade = Math.sin(Math.PI * t) * shoot.alpha;          // gentle in and out
    const hx = shoot.x + shoot.dx * shoot.dist * p, hy = shoot.y + shoot.dy * shoot.dist * p;
    const tail = shoot.len * Math.min(1, t * 3) * (1 - t * .5);
    const tx = hx - shoot.dx * tail, ty = hy - shoot.dy * tail;
    const g = ctx.createLinearGradient(tx, ty, hx, hy);
    g.addColorStop(0, `rgba(${c.colour},0)`);
    g.addColorStop(1, `rgba(${c.colour},${fade})`);
    ctx.strokeStyle = g; ctx.lineWidth = 1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = `rgba(${c.colour},${fade})`;
    ctx.beginPath(); ctx.arc(hx, hy, 1.1, 0, Math.PI * 2); ctx.fill();
  }

  /* — constellations (fade in, hold, fade out) — */
  function spawnConstellation(now) {
    const C = SKY.constellations;
    let slotIndex;
    do { slotIndex = Math.floor(Math.random() * C.slots.length); } while (slotIndex === lastSlot && C.slots.length > 1);
    lastSlot = slotIndex;
    const slot = C.slots[slotIndex];
    constel = {
      shape: pick(C.shapes), size: isMobile() ? C.size.mobile : C.size.desktop,
      cx: slot.x * W, cy: slot.y * H, start: now, scroll0: scrollSmooth,
      rot: rand(-.35, .35),
    };
  }
  function drawConstellation(now, staticAlpha) {
    const C = SKY.constellations;
    const k = constel;
    let starA, lineProgress, lineA;
    if (staticAlpha != null) { starA = lineA = staticAlpha; lineProgress = 1; }
    else {
      const e = now - k.start, total = C.fadeIn + C.hold + C.fadeOut;
      if (e > total) { constel = null; nextConstelAt = now + rand(C.gap[0], C.gap[1]); return; }
      if (e < C.fadeIn) { const t = easeInOut(e / C.fadeIn); starA = t; lineProgress = Math.max(0, (e / C.fadeIn - .25) / .75); lineA = t; }
      else if (e < C.fadeIn + C.hold) { starA = lineA = lineProgress = 1; }
      else { starA = lineA = 1 - easeInOut((e - C.fadeIn - C.hold) / C.fadeOut); lineProgress = 1; }
    }
    const drift = staticAlpha != null ? 0 : (scrollSmooth - k.scroll0) * .12;
    const cos = Math.cos(k.rot), sin = Math.sin(k.rot);
    const pts = k.shape.points.map(([px, py]) => {
      const x = (px - .5) * k.size, y = (py - .5) * k.size;
      return [k.cx + x * cos - y * sin, k.cy + x * sin + y * cos - drift];
    });

    ctx.lineWidth = .6;
    ctx.strokeStyle = `rgba(${C.lineColour},${C.lineAlpha * lineA})`;
    ctx.beginPath();
    k.shape.lines.forEach(([i, j]) => {
      const [x1, y1] = pts[i], [x2, y2] = pts[j];
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + (x2 - x1) * easeInOut(lineProgress), y1 + (y2 - y1) * easeInOut(lineProgress));
    });
    ctx.stroke();

    pts.forEach(([x, y], i) => {
      const r = i % 3 === 0 ? 1.6 : 1.15;
      ctx.fillStyle = `rgba(${C.starColour},${C.starAlpha * starA})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(${C.starColour},${C.starAlpha * starA * .12})`;
      ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2); ctx.fill();
    });
  }

  /* — loop — */
  function frame(now) {
    const dt = Math.min(64, now - (last || now)); last = now;
    const k = 1 - Math.pow(1 - SKY.scrollEase, dt / 16.67);
    scrollSmooth += (window.scrollY - scrollSmooth) * k;

    ctx.clearRect(0, 0, W, H);
    drawStars(now, false);

    if (SKY.constellations.enabled) {
      if (!constel && now >= nextConstelAt) spawnConstellation(now);
      if (constel) drawConstellation(now);
    }
    if (SKY.shootingStar.enabled) {
      if (!shoot && now >= nextShootAt) spawnShootingStar(now);
      if (shoot) drawShootingStar(now);
    }
    raf = requestAnimationFrame(frame);
  }

  /* — static sky for reduced motion — */
  function drawStatic() {
    ctx.clearRect(0, 0, W, H);
    drawStars(0, true);
    if (SKY.constellations.enabled) {
      const C = SKY.constellations;
      constel = { shape: C.shapes[0], size: isMobile() ? C.size.mobile : C.size.desktop, cx: C.slots[1].x * W, cy: C.slots[1].y * H, rot: -.15, scroll0: 0 };
      drawConstellation(0, .7);
      constel = null;
    }
  }

  function start() {
    cancelAnimationFrame(raf); raf = null;
    resize();
    if (motionQuery.matches) { drawStatic(); return; }
    const now = performance.now();
    last = 0; shoot = null; constel = null;
    nextShootAt = now + rand(4000, 9000);      // first shooting star after a short wait
    nextConstelAt = now + 1500;
    raf = requestAnimationFrame(frame);
  }

  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(start, 200); });
  motionQuery.addEventListener('change', start);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !motionQuery.matches) {   // avoid a burst of events after returning to the tab
      const now = performance.now();
      nextShootAt = Math.max(nextShootAt, now + 3000);
      last = 0;
    }
  });
  start();
})();

/* ═══════════════════════════════════════════════════════
   NAVIGATION — scrolled state + mobile menu
   ═══════════════════════════════════════════════════════ */
(function nav() {
  const nav = document.getElementById('nav');
  const toggle = nav.querySelector('.nav__toggle');
  const links = nav.querySelectorAll('.nav__links a');

  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function setOpen(open) {
    nav.dataset.open = open;
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  toggle.addEventListener('click', () => setOpen(nav.dataset.open !== 'true'));
  links.forEach(a => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && nav.dataset.open === 'true') { setOpen(false); toggle.focus(); }
  });
})();

/* ═══════════════════════════════════════════════════════
   FOOTER CONSTELLATION — draws itself when it scrolls into view
   ═══════════════════════════════════════════════════════ */
(function footerConstellation() {
  const el = document.getElementById('footerConstellation');
  if (!('IntersectionObserver' in window)) { el.classList.add('is-drawn'); return; }
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { el.classList.add('is-drawn'); io.disconnect(); } });
  }, { threshold: .3 });
  io.observe(el);
})();

/* ═══════════════════════════════════════════════════════
   TONIGHT'S MOON — shades the orbit circle to today's phase
   ═══════════════════════════════════════════════════════ */
(function moon() {
  const SYNODIC = 29.530588853;                          // days per lunar cycle
  const KNOWN_NEW = Date.UTC(2000, 0, 6, 18, 14);        // a known new moon
  const days = (Date.now() - KNOWN_NEW) / 864e5;
  const phase = ((days / SYNODIC) % 1 + 1) % 1;          // 0 new → .5 full → 1 new
  const lit = (1 - Math.cos(2 * Math.PI * phase)) / 2;   // fraction illuminated
  const waxing = phase < .5;

  const names = [[.0339, 'new moon'], [.216, 'waxing crescent'], [.284, 'first quarter'], [.466, 'waxing gibbous'],
                 [.534, 'full moon'], [.716, 'waning gibbous'], [.784, 'last quarter'], [.966, 'waning crescent'], [1, 'new moon']];
  const name = names.find(([max]) => phase < max)[1];

  // Lit shape: the bright limb is a half circle, the terminator a half ellipse
  const cx = 200, cy = 200, r = 190, rx = r * Math.abs(2 * lit - 1);
  const limbSweep = waxing ? 1 : 0;                      // waxing lights the right side (northern sky)
  const termSweep = waxing ? (lit < .5 ? 0 : 1) : (lit < .5 ? 1 : 0);
  document.getElementById('moonLit').setAttribute('d',
    `M${cx} ${cy - r} A${r} ${r} 0 0 ${limbSweep} ${cx} ${cy + r} A${rx} ${r} 0 0 ${termSweep} ${cx} ${cy - r}Z`);

  document.getElementById('moonCaption').textContent =
    `Tonight’s moon: ${name}, ${Math.round(lit * 100)}% lit`;
})();

/* ═══════════════════════════════════════════════════════
   EASTER EGG — click the gold planet to send a shooting star
   ═══════════════════════════════════════════════════════ */
(function wish() {
  const planet = document.getElementById('wishPlanet');
  planet.addEventListener('click', () => {
    const r = planet.getBoundingClientRect();
    if (window.wishOnStar) window.wishOnStar(r.left + r.width / 2, r.top + r.height / 2);
  });
})();

/* ═══════════════════════════════════════════════════════
   DYNAMIC NAME — letters swell toward the cursor; the two
   lines drift apart as you scroll away from the hero
   ═══════════════════════════════════════════════════════ */
(function heroType() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const letters = [...document.querySelectorAll('.hero__headline .ch')];
  const first = document.querySelector('.hero__headline .line--name');
  const second = document.querySelector('.hero__headline .line--last');
  const REACH = 320;                       // px — how far the cursor's pull extends
  let mx = -1e4, my = -1e4, swellQueued = false, driftQueued = false;

  function swell() {
    swellQueued = false;
    letters.forEach(l => {
      const r = l.getBoundingClientRect();
      const d = Math.hypot(mx - (r.left + r.width / 2), my - (r.top + r.height / 2));
      const k = Math.max(0, 1 - d / REACH);
      l.style.setProperty('--wt', Math.round(700 + 100 * k));      // 700 → 800
      l.style.setProperty('--wd', (92 + 8 * k).toFixed(1));         // 92 → 100
    });
  }
  window.addEventListener('pointermove', e => {
    if (reduce.matches || !finePointer.matches) return;
    mx = e.clientX; my = e.clientY;
    if (!swellQueued) { swellQueued = true; requestAnimationFrame(swell); }
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { mx = my = -1e4; swell(); });

  function drift() {
    driftQueued = false;
    if (reduce.matches) { first.style.translate = second.style.translate = ''; return; }
    const y = Math.min(window.scrollY, window.innerHeight);
    first.style.translate = `${(-y * .12).toFixed(1)}px 0`;
    second.style.translate = `${(y * .2).toFixed(1)}px 0`;
  }
  window.addEventListener('scroll', () => {
    if (!driftQueued) { driftQueued = true; requestAnimationFrame(drift); }
  }, { passive: true });
  reduce.addEventListener('change', () => { mx = my = -1e4; swell(); drift(); });
})();

/* ═══════════════════════════════════════════════════════
   CUSTOM CURSOR — gold star that follows exactly, ring that trails
   ═══════════════════════════════════════════════════════ */
(function cursor() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const star = document.querySelector('.cursor-star');
  const ring = document.querySelector('.cursor-ring');
  const TRAIL = .18;                       // ring follow speed (1 = no trail)
  let x = -100, y = -100, rx = -100, ry = -100;
  root.classList.add('has-cursor');

  window.addEventListener('pointermove', e => {
    x = e.clientX; y = e.clientY;
    star.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    root.classList.add('cursor-on');
    const t = e.target;
    const hover = !!t.closest('a, button');
    const light = !!t.closest('[data-cursor="light"]');
    ring.classList.toggle('is-hover', hover); star.classList.toggle('is-hover', hover);
    ring.classList.toggle('is-light', light); star.classList.toggle('is-light', light);
  }, { passive: true });

  document.addEventListener('mouseleave', () => root.classList.remove('cursor-on'));
  window.addEventListener('mousedown', () => ring.classList.add('is-down'));
  window.addEventListener('mouseup', () => ring.classList.remove('is-down'));

  (function follow() {
    const k = reduce.matches ? 1 : TRAIL;
    rx += (x - rx) * k; ry += (y - ry) * k;
    ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
    requestAnimationFrame(follow);
  })();
})();

/* ═══════════════════════════════════════════════════════
   PHOTO GRID — cuts the hero photo into square tiles, a few
   nudged out of line like a pasted-up poster
   ═══════════════════════════════════════════════════════ */
const GRID = {
  cols: 3, rows: 4,       // 3 × 4 squares for a 3:4 photo
  gone: [0],              // tiles left empty (the poster shows through) — use [] for none
  nudge: {},              // optional offsets, e.g. { 4: [10, 0] } moves tile 4 right 10px
  scrollSpread: 0,        // 0 = tiles stay still when scrolling
};
(function photoGrid() {
  const photo = document.getElementById('heroPhoto');
  const holder = document.getElementById('heroTiles');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  holder.style.gridTemplateColumns = `repeat(${GRID.cols}, 1fr)`;
  holder.style.gridTemplateRows = `repeat(${GRID.rows}, 1fr)`;
  const tiles = [];
  for (let i = 0; i < GRID.cols * GRID.rows; i++) {
    const t = document.createElement('span');
    t.className = 'tile' + (GRID.gone.includes(i) ? ' tile--gone' : '') + '';
    t.style.setProperty('--i', i);
    holder.appendChild(t);
    const [nx, ny] = GRID.nudge[i] || [0, 0];
    tiles.push({ el: t, nx, ny, dir: (i % 2 ? 1 : -1) * (1 + (i % 3) * .5) });
  }
  function layout() {                 // line each tile up with its part of the photo
    const gap = parseFloat(getComputedStyle(holder).columnGap) || 0;
    const w = holder.clientWidth, h = holder.clientHeight;
    const tw = (w - gap * (GRID.cols - 1)) / GRID.cols, th = (h - gap * (GRID.rows - 1)) / GRID.rows;
    photo.style.setProperty('--bw', w + 'px');
    photo.style.setProperty('--bh', h + 'px');
    tiles.forEach(({ el }, i) => {
      el.style.setProperty('--bx', -((i % GRID.cols) * (tw + gap)) + 'px');
      el.style.setProperty('--by', -(Math.floor(i / GRID.cols) * (th + gap)) + 'px');
    });
  }
  function place() {
    const y = reduce.matches ? 0 : Math.min(window.scrollY, window.innerHeight) * GRID.scrollSpread;
    tiles.forEach(t => {
      t.el.style.setProperty('--tx', t.nx + 'px');
      t.el.style.setProperty('--ty', (t.ny + y * t.dir).toFixed(1) + 'px');
    });
  }
  let queued = false;
  window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; place(); }); } }, { passive: true });
  window.addEventListener('resize', layout);
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(holder);
  reduce.addEventListener('change', place);
  layout(); place();

  const rings = document.getElementById('ringsFront');
  const syncRings = () => { if (rings.pauseAnimations) reduce.matches ? rings.pauseAnimations() : rings.unpauseAnimations(); };
  reduce.addEventListener('change', syncRings); syncRings();
})();

/* STICKERS — quietly hide any sticker whose image file is missing */
document.querySelectorAll('.sticker').forEach(img => {
  const hide = () => { img.style.display = 'none'; };
  if (img.complete && img.naturalWidth === 0) hide();
  else img.addEventListener('error', hide);
});

document.getElementById('year').textContent = new Date().getFullYear();
