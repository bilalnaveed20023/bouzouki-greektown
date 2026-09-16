/* ============================================================================
   BOUZOUKI GREEKTOWN — interaction layer
   No dependencies. Everything degrades: with JS off you still get a complete,
   readable, navigable site.
   ========================================================================== */
(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE    = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* Storage is unreliable (private windows, blocked cookies) — never trust it. */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* no-op */ } },
    sget(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    sset(k, v) { try { sessionStorage.setItem(k, v); } catch { /* no-op */ } },
    sdel(k) { try { sessionStorage.removeItem(k); } catch { /* no-op */ } }
  };

  const lock   = () => { document.documentElement.classList.add('is-locked'); document.body.classList.add('is-locked'); };
  const unlock = () => { document.documentElement.classList.remove('is-locked'); document.body.classList.remove('is-locked'); };

  /* ------------------------------------------------------------------------
     1. TRADING HOURS  (authoritative: the club's own Instagram bio)
     Tue–Sat 6pm–2am · Sun 8pm–2am · Mon closed. All times America/Detroit.
     --------------------------------------------------------------------- */
  const HOURS = [
    { open: 20, close: 2 }, // Sun
    null,                   // Mon — dark
    { open: 18, close: 2 }, // Tue
    { open: 18, close: 2 }, // Wed
    { open: 18, close: 2 }, // Thu
    { open: 18, close: 2 }, // Fri
    { open: 18, close: 2 }  // Sat
  ];
  const DAY_IX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  function detroitNow() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Detroit', weekday: 'short', hour: '2-digit',
      minute: '2-digit', hour12: false
    }).formatToParts(new Date()).reduce((a, p) => (a[p.type] = p.value, a), {});
    return {
      day: DAY_IX[parts.weekday] ?? new Date().getDay(),
      hour: parseInt(parts.hour, 10) % 24,
      minute: parseInt(parts.minute, 10)
    };
  }

  const clock = (h) => {
    const m = h % 12 === 0 ? 12 : h % 12;
    return `${m}:00 ${h < 12 || h === 24 ? 'AM' : 'PM'}`;
  };

  /** Resolve open/closed plus a human line, accounting for the 2am rollover. */
  function doorStatus() {
    const { day, hour, minute } = detroitNow();
    const today = HOURS[day];
    const prev  = HOURS[(day + 6) % 7];

    // Still inside last night's session (midnight–2am).
    if (hour < 2 && prev) {
      return { open: true, line: 'Open now · last call at 2:00 AM' };
    }
    if (today && hour >= today.open) {
      return { open: true, line: 'Open now · until 2:00 AM' };
    }
    if (today && hour < today.open) {
      return { open: false, line: `Doors at ${clock(today.open)} tonight` };
    }
    // Dark tonight — find the next night with hours.
    for (let i = 1; i <= 7; i++) {
      const d = (day + i) % 7;
      if (HOURS[d]) {
        const name = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d];
        return { open: false, line: `Closed · back ${name} at ${clock(HOURS[d].open)}` };
      }
    }
    return { open: false, line: 'Closed' };
  }

  function paintStatus() {
    const s = doorStatus();
    $$('[data-status]').forEach((el) => {
      el.classList.toggle('is-open', s.open);
      const t = $('[data-status-text]', el) || el;
      t.textContent = s.open ? 'Open now' : 'Closed';
      el.setAttribute('title', s.line);
    });
    $$('[data-status-line]').forEach((el) => { el.textContent = s.line; });
    // Flag tonight's row in any hours table.
    const { day, hour } = detroitNow();
    const activeDay = hour < 2 ? (day + 6) % 7 : day;
    $$('[data-day]').forEach((row) => {
      row.classList.toggle('is-today', Number(row.dataset.day) === activeDay);
    });
  }

  /* ------------------------------------------------------------------------
     2. PRELOADER
     --------------------------------------------------------------------- */
  const BOOT_KEY = 'bz.booted';

  function boot() {
    const el = $('#boot');
    if (!el) { return Promise.resolve(); }
    // Once per session only. On internal navigation the page curtain covers the
    // hand-off, so replaying the whole preloader would double up and feel slow.
    if (store.sget(BOOT_KEY) === '1') { el.remove(); return Promise.resolve(); }
    store.sset(BOOT_KEY, '1');
    const bar = $('.boot__bar i', el);
    const pct = $('.boot__pct', el);
    lock();

    return new Promise((resolve) => {
      const MIN = REDUCED ? 240 : 850;    // never flash past the mark
      const MAX = 2400;                   // never trap anyone behind it
      const t0 = performance.now();
      let assetsIn = false;
      let done = false;

      // Race font loading against a short timeout: the stylesheet already uses
      // font-display:swap, so a slow Google Fonts response must not hold the door.
      Promise.race([
        document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve(),
        new Promise((r) => setTimeout(r, 1600))
      ]).then(() => { assetsIn = true; });

      const paint = (p) => {
        if (bar) { bar.style.transform = `scaleX(${p / 100})`; }
        if (pct) { pct.textContent = String(Math.round(p)).padStart(3, '0'); }
      };

      const finish = () => {
        if (done) { return; }
        done = true;
        paint(100);
        el.hidden = true;
        setTimeout(() => el.remove(), 800);
        resolve();
      };

      // Progress is derived from elapsed TIME, not from frame count — a throttled
      // or backgrounded tab gets very few frames and an easing-per-frame ramp
      // would stall there forever.
      const tick = () => {
        if (done) { return; }
        const elapsed = performance.now() - t0;
        if ((assetsIn && elapsed >= MIN) || elapsed >= MAX) { finish(); return; }
        paint(Math.min(94, (elapsed / MIN) * 94));
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      setTimeout(finish, MAX + 120);  // belt and braces if rAF never runs
    });
  }

  /* ------------------------------------------------------------------------
     3. AGE GATE
     --------------------------------------------------------------------- */
  const GATE_KEY = 'bz.age.ok';

  function gate() {
    const el = $('#gate');
    if (!el) { unlock(); return Promise.resolve(); }
    if (store.get(GATE_KEY) === '1') { el.remove(); unlock(); return Promise.resolve(); }

    lock();
    el.hidden = false;
    return new Promise((resolve) => {
      $('[data-gate-yes]', el)?.addEventListener('click', () => {
        store.set(GATE_KEY, '1');
        el.style.transition = 'opacity .6s var(--ease)';
        el.style.opacity = '0';
        setTimeout(() => { el.remove(); unlock(); resolve(); }, 620);
      });
      $('[data-gate-no]', el)?.addEventListener('click', () => {
        el.innerHTML =
          '<div class="gate__panel"><p class="t-eyebrow">Thanks for stopping by</p>' +
          '<p class="t-lg">Come back when you’re 21.</p>' +
          '<p class="gate__fine">Bouzouki Greektown is a 21-and-over venue. ' +
          'Valid government-issued photo identification is required for entry, no exceptions.</p></div>';
      });
    });
  }

  /* ------------------------------------------------------------------------
     5. NAV — condense on scroll, retreat on scroll-down
     --------------------------------------------------------------------- */
  function nav() {
    const bar = $('.nav');
    if (!bar) { return; }
    let last = scrollY, raf = 0;
    const onScroll = () => {
      if (raf) { return; }
      raf = requestAnimationFrame(() => {
        const y = scrollY;
        bar.classList.toggle('is-stuck', y > 40);
        const menuOpen = $('.menu')?.classList.contains('is-open');
        bar.classList.toggle('is-hidden', !menuOpen && y > 400 && y > last + 6);
        last = y;
        raf = 0;
      });
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ------------------------------------------------------------------------
     6. MENU OVERLAY
     --------------------------------------------------------------------- */
  function menu() {
    const panel  = $('.menu');
    const burger = $('.burger');
    if (!panel || !burger) { return; }

    $$('.menu__a', panel).forEach((a, i) => { a.style.transitionDelay = `${120 + i * 55}ms`; });

    const toggle = (want) => {
      const open = want ?? !panel.classList.contains('is-open');
      panel.classList.toggle('is-open', open);
      burger.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      panel.setAttribute('aria-hidden', String(!open));
      open ? lock() : unlock();
    };

    burger.addEventListener('click', () => toggle());
    $$('.menu__a, .menu__foot a', panel).forEach((a) => a.addEventListener('click', () => toggle(false)));
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) { toggle(false); }
    });
  }

  /* ------------------------------------------------------------------------
     7. REVEAL CHOREOGRAPHY
     --------------------------------------------------------------------- */
  function reveals() {
    const items = $$('[data-reveal], .lines');
    if (!items.length) { return; }
    if (REDUCED || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-in'));
      return;
    }
    // Stagger within a shared group so rows cascade rather than pop together.
    $$('[data-stagger]').forEach((grp) => {
      const step = Number(grp.dataset.stagger) || 90;
      Array.from(grp.children).forEach((c, i) => {
        const t = c.matches('[data-reveal], .lines') ? c : $('[data-reveal], .lines', c);
        if (t) { t.style.setProperty('--d', `${i * step}ms`); }
      });
    });
    $$('.lines').forEach((l) => {
      $$('.lines__i', l).forEach((i, n) => i.style.setProperty('--d', `${n * 85}ms`));
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    items.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------------------
     8. HERO LOCKUP — split the wordmark, then light it
     --------------------------------------------------------------------- */
  function lockup() {
    const word = $('[data-split]');
    if (word) {
      const text = word.textContent.trim();
      word.setAttribute('aria-label', text);
      word.textContent = '';
      [...text].forEach((ch, i) => {
        const s = document.createElement('span');
        s.className = 'lockup__ch';
        s.textContent = ch;
        s.setAttribute('aria-hidden', 'true');
        s.style.setProperty('--d', `${i * 62}ms`);
        word.appendChild(s);
      });
    }
    // Belt and braces: the split characters start translated out of view, so if
    // this class never lands the headline is invisible. Never gate it on rAF alone.
    let lit = false;
    const light = () => {
      if (lit) { return; }
      lit = true;
      $('.hero')?.classList.add('is-lit');
    };
    requestAnimationFrame(light);
    setTimeout(light, 80);

    // Longest char transition is 1.2s plus a 62ms-per-character stagger.
    const settleAfter = 1200 + 62 * ((word?.children.length || 8) + 1) + 200;
    setTimeout(() => $('.lockup')?.classList.add('is-settled'), REDUCED ? 0 : settleAfter);
  }

  /* ------------------------------------------------------------------------
     9. MARQUEE — clone the track until it covers twice the viewport
     --------------------------------------------------------------------- */
  function marquees() {
    $$('.marquee').forEach((m) => {
      const track = $('.marquee__track', m);
      if (!track) { return; }
      const clone = () => {
        const c = track.cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        m.appendChild(c);
      };
      let guard = 0;
      while (track.scrollWidth < m.offsetWidth * 2 && guard < 6) {
        track.append(...Array.from(track.children).map((n) => n.cloneNode(true)));
        guard++;
      }
      clone();
    });
  }

  /* ------------------------------------------------------------------------
     10. SPOTLIGHT — a wash that follows the pointer
     --------------------------------------------------------------------- */
  function spotlight() {
    if (!FINE) { return; }
    $$('.spot').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
        el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
      }, { passive: true });
    });
  }

  /* ------------------------------------------------------------------------
     11. HORIZONTAL RAIL — vertical scroll drives lateral travel
     --------------------------------------------------------------------- */
  function rails() {
    if (REDUCED) { return; }
    $$('.rail').forEach((rail) => {
      const track = $('.rail__track', rail);
      if (!track) { return; }
      let raf = 0;
      const run = () => {
        if (raf) { return; }
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (!matchMedia('(min-width: 62rem)').matches) { track.style.transform = ''; return; }
          const r = rail.getBoundingClientRect();
          const span = rail.offsetHeight - innerHeight;
          if (span <= 0) { return; }
          const p = Math.min(1, Math.max(0, -r.top / span));
          const travel = track.scrollWidth - innerWidth + parseFloat(getComputedStyle(track).paddingLeft) * 2;
          track.style.transform = `translate3d(${-p * Math.max(0, travel)}px, 0, 0)`;
        });
      };
      addEventListener('scroll', run, { passive: true });
      addEventListener('resize', run);
      run();
    });
  }

  /* ------------------------------------------------------------------------
     12. COUNTERS
     --------------------------------------------------------------------- */
  function counters() {
    const els = $$('[data-count]');
    if (!els.length) { return; }
    if (REDUCED || !('IntersectionObserver' in window)) {
      els.forEach((el) => { el.textContent = el.dataset.prefix ? el.dataset.prefix + el.dataset.count : el.dataset.count; });
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) { return; }
        io.unobserve(e.target);
        const el = e.target;
        const end = Number(el.dataset.count);
        const pre = el.dataset.prefix || '';
        const suf = el.dataset.suffix || '';
        const t0 = performance.now();
        const dur = 1500;
        let settled = false;
        const settle = () => { if (!settled) { settled = true; el.textContent = pre + end + suf; } };
        const step = (t) => {
          if (settled) { return; }
          const p = Math.min(1, (t - t0) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = pre + Math.round(end * eased) + suf;
          if (p < 1) { requestAnimationFrame(step); } else { settled = true; }
        };
        requestAnimationFrame(step);
        // Guarantee the true value lands even if frames stop being delivered.
        setTimeout(settle, dur + 250);
      });
    }, { threshold: 0.5 });
    els.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------------------
     13. FAQ
     --------------------------------------------------------------------- */
  function faq() {
    $$('.faq__item').forEach((item) => {
      const q = $('.faq__q', item);
      const a = $('.faq__a', item);
      if (!q || !a) { return; }
      q.addEventListener('click', () => {
        const open = item.classList.toggle('is-open');
        q.setAttribute('aria-expanded', String(open));
        a.setAttribute('aria-hidden', String(!open));
      });
    });
  }

  /* ------------------------------------------------------------------------
     14. MAGNETIC BUTTONS
     --------------------------------------------------------------------- */
  function magnets() {
    if (!FINE || REDUCED) { return; }
    $$('.btn').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        b.style.transform = `translate(${dx * 9}px, ${dy * 6}px)`;
      }, { passive: true });
      b.addEventListener('pointerleave', () => {
        b.style.transition = 'transform .55s var(--ease)';
        b.style.transform = '';
        setTimeout(() => { b.style.transition = ''; }, 560);
      });
    });
  }

  /* ------------------------------------------------------------------------
     15. PAGE CURTAIN — real multi-page navigation, SPA-smooth
     --------------------------------------------------------------------- */
  const NAV_FLAG = 'bz.nav';

  function curtainIn() {
    const c = $('.curtain');
    if (!c) { return; }
    if (store.sget(NAV_FLAG) !== '1' || REDUCED) { store.sdel(NAV_FLAG); return; }
    store.sdel(NAV_FLAG);

    // Pin it over the page with no transition, then sweep it off next frame.
    c.classList.add('is-held');

    const clear = () => {
      // Snap, don't transition: reverting from "swept below" to the parked
      // position above would otherwise animate straight back across the page.
      c.style.transition = 'none';
      c.classList.remove('is-held', 'is-in');
      void c.offsetHeight;
      c.style.transition = '';
      c.removeEventListener('transitionend', clear);
      clearTimeout(guard);
    };
    // Two independent ways out, because a dropped transitionend must never
    // leave the curtain sitting on top of the site.
    const guard = setTimeout(clear, 1400);
    c.addEventListener('transitionend', clear);

    // rAF is the preferred trigger, but fall back to a timer: if frames are
    // never delivered (throttled or backgrounded tab) the curtain must still lift.
    let swapped = false;
    const swap = () => {
      if (swapped) { return; }
      swapped = true;
      void c.offsetHeight;          // flush the no-transition state
      c.classList.remove('is-held');
      c.classList.add('is-in');
    };
    requestAnimationFrame(swap);
    setTimeout(swap, 60);
  }

  function curtainOut() {
    const c = $('.curtain');
    if (!c || REDUCED) { return; }
    document.addEventListener('click', (e) => {
      const a = e.target.closest?.('a');
      if (!a) { return; }
      const href = a.getAttribute('href') || '';
      if (a.target === '_blank' || a.hasAttribute('download')) { return; }
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) { return; }
      if (/^(#|mailto:|tel:)/i.test(href)) { return; }
      if (/^https?:/i.test(href) && !href.startsWith(location.origin)) { return; }
      if (!/\.html?($|[?#])/i.test(href)) { return; }
      // Same document? Let the browser handle the hash or the no-op.
      let target;
      try { target = new URL(href, location.href); } catch { return; }
      if (target.pathname === location.pathname) { return; }

      e.preventDefault();
      store.sset(NAV_FLAG, '1');
      c.classList.add('is-out');
      // Navigate on transitionend, with a timer as the guaranteed path.
      let gone = false;
      const go = () => { if (!gone) { gone = true; location.href = target.href; } };
      c.addEventListener('transitionend', go, { once: true });
      setTimeout(go, 700);
    });
  }

  /* ------------------------------------------------------------------------
     16. FORMS — compose a prefilled message to the club.
     No backend needed on day one; swap `action` for an endpoint when there is.
     --------------------------------------------------------------------- */
  function forms() {
    $$('form[data-mailto]').forEach((f) => {
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!f.reportValidity()) { return; }
        const to = f.dataset.mailto;
        const data = new FormData(f);
        const lines = [];
        for (const [k, v] of data.entries()) {
          if (String(v).trim()) { lines.push(`${k}: ${v}`); }
        }
        const subject = f.dataset.subject || 'Website enquiry';
        const href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
        f.classList.add('is-sent');
        window.location.href = href;
      });
    });
  }

  /* ------------------------------------------------------------------------
     17. SHOWCASE — auto-advancing stage reel
     --------------------------------------------------------------------- */
  function showcase() {
    const el = $('.showcase');
    if (!el) { return; }
    const shots = $$('.shot', el);
    const ticks = $$('.tick', el);
    const count = $('[data-shot-count]', el);
    if (shots.length < 2) { return; }

    const DUR = Number(el.dataset.shotDur) || 5600;
    el.style.setProperty('--shot-dur', `${DUR}ms`);

    let at = 0;
    let timer = 0;
    const pad = (n) => String(n).padStart(2, '0');

    /* Only the current shot and its neighbours get a background-image, so eight
       full-bleed photographs do not all download on first paint. */
    const load = (n) => {
      const shot = shots[(n + shots.length) % shots.length];
      if (shot.dataset.loaded) { return; }
      const url = `url('${shot.dataset.shot}')`;
      const img = $('.shot__img', shot);
      const blur = $('.shot__blur', shot);
      if (!img) { return; }
      img.style.backgroundImage = url;
      if (blur) { blur.style.backgroundImage = url; }
      shot.dataset.loaded = '1';
    };

    const paint = () => {
      shots.forEach((s, i) => s.classList.toggle('is-on', i === at));
      ticks.forEach((t, i) => {
        // Restart the fill animation by detaching and re-adding the class.
        t.classList.remove('is-live');
        t.classList.toggle('is-done', i < at);
        if (i === at) { void t.offsetWidth; t.classList.add('is-live'); }
      });
      if (count) { count.textContent = `${pad(at + 1)} / ${pad(shots.length)}`; }
      load(at); load(at + 1); load(at - 1);
    };

    const go = (n, resume = true) => {
      at = (n + shots.length) % shots.length;
      paint();
      if (resume) { start(); }
    };
    let inView = true;
    const start = () => {
      clearTimeout(timer);
      if (REDUCED) { return; }          // no auto-advance when motion is reduced
      if (!inView || document.hidden) { return; }
      timer = setTimeout(() => go(at + 1), DUR);
    };
    const hold = (on) => {
      el.classList.toggle('is-held', on);
      if (on) { clearTimeout(timer); } else { start(); }
    };

    $('[data-shot-next]', el)?.addEventListener('click', () => go(at + 1));
    $('[data-shot-prev]', el)?.addEventListener('click', () => go(at - 1));
    ticks.forEach((t, i) => t.addEventListener('click', () => go(i)));

    // Hover-pause is scoped to the controls, NOT the whole band. The band is
    // full-bleed and ~700px tall, so simply scrolling past leaves the cursor
    // inside it — bound to `el` this fired pointerenter and the reel sat frozen
    // until you moved the mouse out or clicked, which read as "it won't start".
    const ui = $('.showcase__ui', el);
    ui?.addEventListener('pointerenter', () => hold(true));
    ui?.addEventListener('pointerleave', () => hold(false));
    // Keyboard focus still pauses anywhere in the component.
    el.addEventListener('focusin', () => hold(true));
    el.addEventListener('focusout', () => hold(false));

    // Touch: swipe through.
    let x0 = null;
    el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; clearTimeout(timer); }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (x0 === null) { return; }
      const dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 44) { go(dx < 0 ? at + 1 : at - 1); } else { start(); }
    }, { passive: true });

    addEventListener('keydown', (e) => {
      if (!el.matches(':hover') && !el.contains(document.activeElement)) { return; }
      if (e.key === 'ArrowRight') { go(at + 1); }
      if (e.key === 'ArrowLeft') { go(at - 1); }
    });

    // Don't burn timers or bandwidth while the reel is off-screen.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          inView = en.isIntersecting;
          inView ? start() : clearTimeout(timer);
        });
      }, { threshold: 0.2 }).observe(el);
    }
    document.addEventListener('visibilitychange', () => {
      document.hidden ? clearTimeout(timer) : start();
    });

    paint();
    start();
  }

  /* ------------------------------------------------------------------------
     18. TIER PICKER — clicking a package pre-selects it in the booking form
     --------------------------------------------------------------------- */
  function tierPicker() {
    const sel = $('#f-pkg');
    if (!sel) { return; }
    $$('[data-pick]').forEach((a) => {
      a.addEventListener('click', () => {
        const want = a.dataset.pick.replace(/\s*[—-]\s*/, ' \u2014 ');
        const hit = Array.from(sel.options).find(
          (o) => o.text.replace(/\s+/g, ' ').trim() === want.replace(/\s+/g, ' ').trim()
        );
        if (hit) { sel.value = hit.value || hit.text; }
        // Nudge focus to the form so the choice is obviously registered.
        setTimeout(() => $('#f-name')?.focus({ preventScroll: true }), 700);
      });
    });
  }

  /* ------------------------------------------------------------------------
     19. YEAR + INIT
     --------------------------------------------------------------------- */
  function chrome() {
    $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
  }

  /** Run an init step in isolation: one broken feature must never take the
      whole page down with it, and the boot/gate chain must always complete. */
  function safe(name, fn) {
    try { fn(); } catch (err) { console.warn(`[bouzouki] ${name} failed`, err); }
  }

  function start() {
    safe('chrome', chrome);
    safe('status', () => { paintStatus(); setInterval(paintStatus, 60_000); });
    safe('nav', nav);
    safe('menu', menu);
    safe('marquees', marquees);
    safe('spotlight', spotlight);
    safe('rails', rails);
    safe('counters', counters);
    safe('faq', faq);
    safe('magnets', magnets);
    safe('forms', forms);
    safe('showcase', showcase);
    safe('tierPicker', tierPicker);
    safe('curtainIn', curtainIn);
    safe('curtainOut', curtainOut);

    // The overlays are last and independently guarded — nothing above may
    // prevent the preloader and age gate from clearing.
    boot()
      .then(gate)
      .catch((err) => { console.warn('[bouzouki] overlays failed', err); unlock(); })
      .then(() => { safe('lockup', lockup); safe('reveals', reveals); });
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', start)
    : start();
})();
