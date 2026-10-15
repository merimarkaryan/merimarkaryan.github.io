// Header border on scroll
const header = document.querySelector('.header');
const onScroll = () => header && header.classList.toggle('scrolled', window.scrollY > 8);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Cut transition (after neutomni.com): a blue screen with a white dashed line; scissors cut along it
// and the screen opens up and down. Shown once per visit when entering the home page (with a 0→100 counter)
// and, quicker, between pages: the halves close over the page, the next page loads covered and is cut open.
const pageTransition = (() => {
  const INTRO_CUT = 2600, FAST_CUT = 700, OPEN = 900, CLOSE = 550;
  const root = document.documentElement;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = { get: (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
                  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} },
                  del: (k) => { try { sessionStorage.removeItem(k); } catch (e) {} } };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  const SCISSORS = '<svg viewBox="0 0 48 32" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round">' +
    '<g class="cut__blade cut__blade--a"><circle cx="8" cy="8" r="5"/><path d="M12.4 10.6 46 22"/></g>' +
    '<g class="cut__blade cut__blade--b"><circle cx="8" cy="24" r="5"/><path d="M12.4 21.4 46 10"/></g>' +
    '<circle cx="28" cy="16" r="1.6" fill="#fff" stroke="none"/></svg>';

  let el = null, solid, scissors, strips = null;
  const DIGIT_H = 20;
  const strip = (digits) => '<span class="cut__col"><span class="cut__strip">' + digits.map((d) => '<span>' + d + '</span>').join('') + '</span></span>';
  const build = ({ open = false, meta = false } = {}) => {
    el = document.createElement('div');
    el.className = 'cut' + (open ? ' is-open' : '');
    el.setAttribute('aria-hidden', 'true');
    const tens = [], ones = [];
    for (let i = 0; i <= 10; i++) for (let d = 0; d <= 9; d++) tens.push(d);
    for (let i = 0; i <= 20; i++) ones.push(i % 2 ? 5 : 0);
    el.innerHTML =
      '<div class="cut__half cut__half--top">' +
        (meta ? '<div class="cut__meta"><span class="cut__counter">' + strip([0, 1]) + strip(tens) + strip(ones) + '</span></div>' : '') +
      '</div>' +
      '<div class="cut__half cut__half--bottom"><div class="cut__line"><span class="cut__solid"></span><span class="cut__scissors">' + SCISSORS + '</span></div></div>';
    document.body.appendChild(el);
    solid = el.querySelector('.cut__solid');
    scissors = el.querySelector('.cut__scissors');
    strips = meta ? [...el.querySelectorAll('.cut__strip')] : null;
  };
  const setCounter = (v) => {
    if (!strips) return;
    strips[0].style.transform = `translateY(${-(v / 100) * DIGIT_H}px)`;
    strips[1].style.transform = `translateY(${-(v / 10) * DIGIT_H}px)`;
    strips[2].style.transform = `translateY(${-(v / 5) * DIGIT_H}px)`;
  };
  const cut = (duration) => new Promise((resolve) => {
    el.classList.add('is-snipping');
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration), e = easeInOut(p);
      solid.style.width = (e * 100) + '%';
      scissors.style.transform = `translateX(${(e * window.innerWidth - 40).toFixed(1)}px)`;
      setCounter(e * 100);
      if (p < 1) requestAnimationFrame(tick);
      else { el.classList.remove('is-snipping'); resolve(); }
    };
    requestAnimationFrame(tick);
  });
  const open = () => new Promise((resolve) => {
    el.classList.add('is-open');
    setTimeout(() => { el.remove(); el = null; resolve(); }, OPEN);
  });
  const reveal = async (duration, pause) => {
    root.classList.remove('pt-in');
    await cut(duration);
    await wait(pause);
    await open();
  };

  let ready = Promise.resolve();
  if (root.classList.contains('pt-in')) {
    const arriving = store.get('pt');
    store.del('pt');
    store.set('introSeen', '1');
    if (arriving) { build(); ready = reveal(FAST_CUT, 60); }
    else { build({ meta: true }); ready = reveal(INTRO_CUT, 250); } // first visit to the home page
  }
  // back/forward cache: never leave the page covered
  addEventListener('pageshow', (e) => { if (e.persisted && el) { el.remove(); el = null; root.classList.remove('pt-in'); } });

  // leaving to another page of the site: the halves close over the page, then navigate
  document.addEventListener('click', (e) => {
    if (calm || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    const page = (p) => p.replace(/index\.html$/, '');
    if (url.origin !== location.origin || page(url.pathname) === page(location.pathname) || !/\.html$|\/$/.test(url.pathname)) return;
    e.preventDefault();
    if (el) el.remove();
    build({ open: true });
    el.getBoundingClientRect(); // apply the open state before animating to closed
    el.classList.remove('is-open');
    setTimeout(() => { store.set('pt', '1'); location.href = url.href; }, CLOSE + 60);
  });

  return { ready };
})();

// Statements in word boxes: words appear one by one, letters scramble into place
const setupScramble = (statement) => {
  const words = [];
  const frag = document.createDocumentFragment();
  // each word sits in a nowrap group so trailing punctuation never wraps onto a new line
  let group = null;
  const addWord = (text, key) => {
    group = document.createElement('span');
    group.className = 'g';
    const s = document.createElement('span');
    s.className = key ? 'w key' : 'w';
    s.textContent = text;
    group.appendChild(s);
    frag.appendChild(group);
    words.push(s);
  };
  statement.childNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR') {
      frag.appendChild(document.createElement('br'));
      group = null;
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'MARK') {
      addWord(node.textContent, true);
      return;
    }
    node.textContent.split(/(\s+)/).forEach((tok) => {
      if (!tok) return;
      // spaces and lone punctuation stay as plain text
      if (/^\s+$/.test(tok)) {
        // a non-breaking space glues the next punctuation to the previous word
        if (tok.includes(' ') && group) group.appendChild(document.createTextNode(tok));
        else { frag.appendChild(document.createTextNode(tok)); group = null; }
      } else if (/^[,.:;—–-]+$/.test(tok)) {
        // punctuation appears together with the word before it
        const p = document.createElement('span');
        p.className = 'p';
        p.textContent = tok;
        (group || frag).appendChild(p);
        if (words.length) (words[words.length - 1].punct ||= []).push(p);
      } else addWord(tok, false);
    });
  });
  statement.textContent = '';
  statement.appendChild(frag);

  const animated = document.documentElement.classList.contains('js');
  const glyphs = 'абвгдежзиклмнопрстуфхцчшщэюя0123456789';
  words.forEach((w) => { w.final = w.textContent; });
  let run = 0; // bumping it cancels a running animation (replays and resets)
  const scramble = (el, id) => new Promise((resolve) => {
    const final = el.final;
    el.style.width = el.getBoundingClientRect().width + 'px'; // keep the box steady while letters change
    const duration = 260 + final.length * 30; // ms, time-based so speed doesn't depend on frame rate
    const t0 = performance.now();
    const tick = () => {
      if (id !== run) { resolve(); return; }
      const p = (performance.now() - t0) / duration;
      if (p >= 1) { el.textContent = final; el.style.width = ''; el.classList.add('done'); resolve(); return; }
      const settled = Math.floor(p * final.length);
      el.textContent = final.split('').map((ch, i) =>
        i < settled || /[\s\d+.,:;—‑-]/.test(ch) ? ch : glyphs[Math.floor(Math.random() * glyphs.length)]
      ).join('');
      setTimeout(tick, 45);
    };
    tick();
  });

  const reset = () => {
    run += 1;
    words.forEach((w) => {
      w.classList.remove('in', 'done'); w.textContent = w.final; w.style.width = '';
      (w.punct || []).forEach((p) => p.classList.remove('in'));
    });
  };
  const play = () => {
    if (!animated) { words.forEach((w) => w.classList.add('in', 'done')); return Promise.resolve(); }
    reset();
    const id = run;
    return Promise.all(words.map((w, i) => new Promise((resolve) => {
      setTimeout(() => {
        if (id !== run) { resolve(); return; }
        w.classList.add('in');
        (w.punct || []).forEach((p) => p.classList.add('in'));
        scramble(w, id).then(resolve);
      }, 250 + i * 85);
    })));
  };
  if (!animated) play();
  return { play, reset };
};

const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();

// First screen: starts after the page transition, then the links fade in
const introStatement = document.querySelector('.intro [data-scramble], .cs-intro [data-scramble]');
if (introStatement) {
  const intro = introStatement.closest('.intro, .cs-intro');
  const { play } = setupScramble(introStatement);
  Promise.all([fontsReady, pageTransition.ready]).then(() => {
    intro.classList.add('ready');
    return play();
  }).then(() => intro.classList.add('links-in'));
}

// Other statements play when scrolled into view: once ("Обо мне"),
// or on every entry with data-replay (contacts), hiding again when they leave
document.querySelectorAll('[data-scramble]').forEach((el) => {
  if (el === introStatement) return;
  const { play, reset } = setupScramble(el);
  const replay = el.hasAttribute('data-replay');
  const seen = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) {
      if (!replay) seen.disconnect();
      fontsReady.then(play);
    } else if (replay) reset();
  }, replay ? { rootMargin: '-18% 0px -18% 0px' } : { threshold: 0.35 });
  seen.observe(el);
});

// Replays on every entry into the 18%–82% band of the viewport, scrolling down or up
const SCROLL_BAND = '-18% 0px -18% 0px';

// Glyph ripple (the "water drop" burst on manishkr.xyz): a ring of glyphs spreads from a point,
// a second ring erases them behind it, then everything fades. Drawn on a canvas behind the content.
const setupRipple = (canvas, getOrigin) => {
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@$%&*+=?!<>{}[]';
  const CELL = 16, BAND = 2.8, DRIFT = 1.8, TRAIL_DELAY = 0.18, TRAIL_BAND = 2.2, TRAIL_DRIFT = 0.9, DURATION = 1050;
  const OPACITY = 0.68, CORE = 0.52, OUTER = 1.28; // values used for the project folders
  const ctx = canvas.getContext('2d');
  const color = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2f5bea';
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const hash = (i, k, s) => { const v = Math.sin(i * s + s * 2.45 * k) * 43758.5453; return v - Math.floor(v); };
  let w = 0, h = 0, dpr = 1, cells = [];

  const build = () => {
    const r = canvas.getBoundingClientRect();
    w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height));
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const cols = Math.ceil(w / CELL) + 1, rows = Math.ceil(h / CELL) + 1;
    cells = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      cells.push({
        x: x * CELL + CELL / 2, y: y * CELL + CELL / 2,
        scatter: (hash(i, 29, 347.5) - 0.5) * CELL * 1.3,
        visibility: hash(i, 31, 563.3),
        glyph: GLYPHS[Math.floor(hash(i, 13, 431.9) * GLYPHS.length) % GLYPHS.length],
      });
    }
  };

  const draw = (p, ox, oy) => {
    const reach = Math.max(Math.hypot(ox, oy), Math.hypot(w - ox, oy), Math.hypot(ox, h - oy), Math.hypot(w - ox, h - oy)) * 1.12 + CELL * 2;
    const front = (1 - (1 - p) ** 2.35) * reach;
    const band = CELL * BAND, drift = CELL * DRIFT;
    const tp = clamp(p - TRAIL_DELAY * 1.35, 0, 1);
    const trail = (1 - (1 - tp) ** 2.35) * reach;
    const trailBand = CELL * TRAIL_BAND, trailDrift = CELL * TRAIL_DRIFT;
    const fade = 1 - smooth(0.94, 1, p);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = `600 ${Math.round(CELL * 0.74)}px "SF Mono", Menlo, Monaco, Consolas, monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
    for (const c of cells) {
      const dx = c.x - ox, dy = c.y - oy, dist = Math.hypot(dx, dy);
      const nx = dist > 0 ? dx / dist : 0, ny = dist > 0 ? dy / dist : 0;
      const v = front - dist + c.scatter;
      if (v <= -band) continue;
      const lit = smooth(-band, band * 0.72, v);
      if (c.visibility > clamp(lit * 1.48, 0, 1)) continue;
      const kept = tp > 0 ? smooth(-trailBand, trailBand, dist - trail + c.scatter * 0.28) : 1;
      if (kept <= 0.01) continue;
      const push = (1 - lit) * drift, pull = (1 - kept) * trailDrift;
      const core = lerp(1, CORE, smooth(0.3, 1, lit)), outer = lerp(OUTER, 1, smooth(0.42, 0.92, lit));
      ctx.globalAlpha = clamp(fade * kept * (0.34 + lit * 0.66) * OPACITY * core * outer, 0, 1);
      ctx.fillText(c.glyph, c.x - nx * push + nx * pull, c.y - ny * push + ny * pull);
    }
    ctx.globalAlpha = 1;
  };

  let raf = 0;
  return () => {
    if (!document.documentElement.classList.contains('js')) return;
    cancelAnimationFrame(raf);
    build();
    canvas.classList.add('is-active');
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / DURATION);
      const r = canvas.getBoundingClientRect(), o = getOrigin();
      draw(p, o.x - r.left, o.y - r.top);
      if (p < 1) raf = requestAnimationFrame(tick);
      else { ctx.clearRect(0, 0, w, h); canvas.classList.remove('is-active'); }
    };
    raf = requestAnimationFrame(tick);
  };
};

document.querySelectorAll('[data-ripple]').forEach((section) => {
  const origin = section.querySelector('[data-ripple-origin]') || section;
  // one fixed, full-viewport canvas behind the page, so the rings are never cropped by the section
  const canvas = document.createElement('canvas');
  canvas.className = 'glyph-ripple';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const play = setupRipple(canvas, () => { const r = origin.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  // fires together with the contact statement, on every entry
  new IntersectionObserver(([e]) => { if (e.isIntersecting) play(); }, { rootMargin: SCROLL_BAND }).observe(origin);
});

// Reveal on scroll
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

// Cases as sheets of paper: while the section is pinned, vertical scroll moves the sheets right to left.
// The sheet in the centre is in focus (white paper); when scrolling stops, it settles on the nearest sheet.
const work = document.querySelector('.work');
if (work) {
  const pin = work.querySelector('.work__pin');
  const track = work.querySelector('.work__track');
  const sheets = [...work.querySelectorAll('.sheet')];
  const counter = work.querySelector('.work__current');
  const wide = matchMedia('(min-width: 1001px)');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad = (n) => String(n).padStart(2, '0');
  const counterTotal = work.querySelector('.work__counter');
  if (counterTotal) counterTotal.lastChild.textContent = ' / ' + pad(sheets.length);
  const SCROLL_PER_SHEET = 0.55; // share of the viewport height that moves one sheet
  const NUDGE = 0.1; // a scroll of 10% of a sheet in either direction is enough to go to the next one
  let horizontal = false, step = 0, start = 0, range = 1, current = -1, settleTimer = 0, anchor = 0;

  const position = () => Math.min(1, Math.max(0, (window.scrollY - start) / range)) * (sheets.length - 1);
  const yFor = (index) => start + (index / (sheets.length - 1)) * range;

  const update = () => {
    if (!horizontal) return;
    const pos = position();
    track.style.transform = `translate3d(${(-pos * step).toFixed(1)}px, 0, 0)`;
    sheets.forEach((sheet, i) => sheet.style.setProperty('--focus', (1 - Math.min(1, Math.abs(i - pos))).toFixed(3)));
    const idx = Math.round(pos);
    if (idx !== current) {
      current = idx;
      sheets.forEach((sheet, i) => sheet.classList.toggle('is-current', i === idx));
      if (counter) counter.textContent = pad(idx + 1);
    }
  };

  const layout = () => {
    horizontal = wide.matches && !calm && sheets.length > 1;
    work.classList.toggle('work--horizontal', horizontal);
    if (!horizontal) {
      work.style.height = ''; track.style.transform = '';
      sheets.forEach((sheet) => { sheet.style.removeProperty('--focus'); sheet.classList.add('is-current'); });
      return;
    }
    step = sheets[0].offsetWidth + (parseFloat(getComputedStyle(track).columnGap) || 0);
    work.style.height = pin.offsetHeight + (sheets.length - 1) * window.innerHeight * SCROLL_PER_SHEET + 'px';
    start = work.getBoundingClientRect().top + window.scrollY - parseFloat(getComputedStyle(pin).top);
    range = work.offsetHeight - pin.offsetHeight;
    current = -1;
    anchor = Math.round(position());
    update();
  };

  // soft glide to a sheet: ease-out over ~0.5 s; any new wheel/touch/key input takes over immediately
  let glideFrame = 0;
  const stopGlide = () => cancelAnimationFrame(glideFrame);
  const glide = (to) => {
    stopGlide();
    const from = window.scrollY, dist = to - from;
    if (Math.abs(dist) < 2) return;
    const duration = Math.min(750, Math.max(420, 380 + Math.abs(dist) * 0.6));
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      window.scrollTo({ top: from + dist * (1 - (1 - p) ** 3), behavior: 'instant' });
      if (p < 1) glideFrame = requestAnimationFrame(tick);
    };
    glideFrame = requestAnimationFrame(tick);
  };
  ['wheel', 'touchstart', 'keydown'].forEach((type) => window.addEventListener(type, stopGlide, { passive: true }));

  // once scrolling stops inside the pinned stretch, go to the next sheet in the direction of the scroll
  // (a small nudge is enough); a tiny accidental scroll returns to the sheet you were on
  const settle = () => {
    if (!horizontal) return;
    const y = window.scrollY;
    const pos = position();
    if (y <= start + 1 || y >= start + range - 1) { anchor = Math.round(pos); return; }
    const delta = pos - anchor;
    let target = anchor;
    if (Math.abs(delta) >= 1) target = Math.round(pos);
    else if (Math.abs(delta) > NUDGE) target = anchor + Math.sign(delta);
    target = Math.min(sheets.length - 1, Math.max(0, target));
    anchor = target;
    glide(yFor(target));
  };

  window.addEventListener('scroll', () => {
    requestAnimationFrame(update);
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, 110);
  }, { passive: true });
  window.addEventListener('resize', layout);
  wide.addEventListener('change', layout);
  window.addEventListener('load', layout);

  // a click on a sheet at the side brings it to the centre
  sheets.forEach((sheet, i) => sheet.addEventListener('click', (e) => {
    if (!horizontal || sheet.classList.contains('is-current')) return;
    e.preventDefault();
    anchor = i;
    glide(yFor(i));
  }));

  layout();
}

// Case story blocks: steps scroll on the left, the sticky panel shows the screen of the step in the middle of the screen
document.querySelectorAll('[data-story]').forEach((story) => {
  const steps = [...story.querySelectorAll('.cs-step')];
  const media = [...story.querySelectorAll('.cs-story__media')];
  const panel = story.querySelector('.cs-story__panel');
  const dotsBox = document.createElement('div');
  dotsBox.className = 'cs-story__dots';
  const dots = steps.map((step, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', 'Шаг ' + (i + 1));
    b.addEventListener('click', () => step.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    dotsBox.appendChild(b);
    return b;
  });
  panel.appendChild(dotsBox);
  const show = (i) => [steps, media, dots].forEach((list) => list.forEach((el, k) => el.classList.toggle('is-active', k === i)));
  show(0);
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) show(steps.indexOf(e.target)); });
  }, { rootMargin: '-45% 0px -45% 0px' });
  steps.forEach((step) => io.observe(step));
});

// "Copy email" buttons
document.querySelectorAll('[data-copy-email]').forEach((btn) => {
  const label = btn.textContent;
  btn.addEventListener('click', async () => {
    const email = btn.dataset.copyEmail;
    try {
      await navigator.clipboard.writeText(email);
    } catch (e) {
      // clipboard API unavailable (e.g. plain http): fall back to the mail client
      location.href = 'mailto:' + email;
      return;
    }
    btn.textContent = 'Почта скопирована ✓';
    btn.classList.add('is-copied');
    clearTimeout(btn.resetTimer);
    btn.resetTimer = setTimeout(() => { btn.textContent = label; btn.classList.remove('is-copied'); }, 2000);
  });
});

// Lightbox for interface screenshots
const box = document.createElement('div');
box.className = 'lightbox';
box.innerHTML = '<img alt="">';
document.body.appendChild(box);
const boxImg = box.querySelector('img');
document.querySelectorAll('.cs-shot img, .cs-hero img, .cs-story__media img').forEach((img) => {
  img.style.cursor = 'zoom-in';
  img.addEventListener('click', () => {
    boxImg.src = img.src;
    boxImg.alt = img.alt;
    box.classList.add('open');
  });
});
box.addEventListener('click', () => box.classList.remove('open'));
document.addEventListener('keydown', (e) => e.key === 'Escape' && box.classList.remove('open'));

// Cookie notice: shown until the visitor accepts, the choice is remembered in this browser
(() => {
  const KEY = 'cookiesAccepted';
  try { if (localStorage.getItem(KEY)) return; } catch (e) { /* storage blocked: show the notice anyway */ }
  const bar = document.createElement('div');
  bar.className = 'cookies';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Уведомление о cookies');
  bar.innerHTML = '<p class="cookies__text">Сайт использует cookies, чтобы всё работало как надо.</p><button type="button" class="cookies__btn">Принять</button>';
  document.body.appendChild(bar);
  pageTransition.ready.then(() => setTimeout(() => bar.classList.add('is-visible'), 600));
  bar.querySelector('button').addEventListener('click', () => {
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    bar.classList.remove('is-visible');
    bar.addEventListener('transitionend', () => bar.remove(), { once: true });
  });
})();
