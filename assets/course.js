/* =====================================================================
   Course structure, navigation, progress tracking and the 48h planner.
   Progress is saved in this browser only (localStorage).
   ===================================================================== */
(function () {
  'use strict';

  const COURSE = [
    { id: '00', phase: 'Foundations', title: 'Start Here', file: 'lessons/00-start-here.html', mins: 20, blurb: 'How this course works, what p5.js is, and your first line of code.' },
    { id: '01', phase: 'Foundations', title: 'Canvas, Shapes & Color', file: 'lessons/01-canvas-shapes-color.html', mins: 60, blurb: 'The coordinate grid, drawing shapes, fill/stroke, color modes.' },
    { id: '02', phase: 'Foundations', title: 'Variables & Motion', file: 'lessons/02-variables-motion.html', mins: 60, blurb: 'The draw loop, variables, frameCount, and making things move.' },
    { id: '03', phase: 'Foundations', title: 'Interaction & Decisions', file: 'lessons/03-interaction-decisions.html', mins: 45, blurb: 'Mouse & keyboard, if/else, toggles, and map().' },
    { id: '04', phase: 'Foundations', title: 'Loops & Patterns', file: 'lessons/04-loops-patterns.html', mins: 60, blurb: 'for loops, grids, rings and transformations (translate/rotate).' },
    { id: '05', phase: 'Foundations', title: 'Randomness, Noise & Waves', file: 'lessons/05-random-noise-waves.html', mins: 75, blurb: 'random(), Perlin noise, sin/cos — the secret sauce of organic motion.' },
    { id: '06', phase: 'Foundations', title: 'Arrays, Objects & Particles', file: 'lessons/06-arrays-particles.html', mins: 90, blurb: 'Lists of things, classes, and a full particle system.' },
    { id: '07', phase: 'Sound', title: 'Playing Sound & Loudness', file: 'lessons/07-sound-amplitude.html', mins: 60, blurb: 'Load a track, play/pause, and make visuals pulse with volume.' },
    { id: '08', phase: 'Sound', title: 'Frequencies: FFT & Waveforms', file: 'lessons/08-fft-frequencies.html', mins: 75, blurb: 'Split the music into bass, mids and highs. Spectrum + waveform.' },
    { id: '09', phase: 'Sound', title: 'Beats, Smoothing & Events', file: 'lessons/09-beats-smoothing.html', mins: 75, blurb: 'Detect kicks, smooth jittery values, trigger visual events on the beat.' },
    { id: '10', phase: 'Sound', title: 'Scenes, Palettes & Going Live', file: 'lessons/10-scenes-live.html', mins: 75, blurb: 'Multiple scenes, keyboard control, fullscreen, mic/line-in for DJ sets.' },
    { id: 'P1', phase: 'Projects', title: 'Project 1 — Song Portrait', file: 'projects/p1-song-portrait.html', mins: 300, blurb: 'A visual built for ONE specific song, with sections that follow its structure.' },
    { id: 'P2', phase: 'Projects', title: 'Project 2 — Setlist Engine', file: 'projects/p2-setlist-engine.html', mins: 360, blurb: 'A live visual system for a DJ set: scenes per track, live input, performance controls.' },
    { id: '11', phase: 'Ship it', title: 'Capture & Portfolio', file: 'lessons/11-capture-portfolio.html', mins: 90, blurb: 'Record high-quality video, document your process, and present both projects.' },
  ];

  // The 48-hour plan: work blocks + rest. Hours are relative to your start time.
  const PLAN = [
    { label: 'Block A — Foundations', items: ['00', '01', '02', '03'], hours: 3.5, kind: 'work' },
    { label: 'Break — eat, walk away from the screen', hours: 1, kind: 'rest' },
    { label: 'Block B — Foundations II', items: ['04', '05', '06'], hours: 4, kind: 'work' },
    { label: 'Break — dinner', hours: 1, kind: 'rest' },
    { label: 'Block C — Sound', items: ['07', '08', '09', '10'], hours: 5, kind: 'work' },
    { label: 'Sleep (your brain consolidates what you learned — don\'t skip it)', hours: 8, kind: 'sleep' },
    { label: 'Block D — Project 1: Song Portrait', items: ['P1'], hours: 5.5, kind: 'work' },
    { label: 'Break — lunch', hours: 1, kind: 'rest' },
    { label: 'Block E — Project 2: Setlist Engine', items: ['P2'], hours: 6.5, kind: 'work' },
    { label: 'Break — dinner + show your DJ friend', hours: 1.5, kind: 'rest' },
    { label: 'Block F — Capture & Portfolio', items: ['11'], hours: 2.5, kind: 'work' },
    { label: 'Sleep', hours: 6.5, kind: 'sleep' },
    { label: 'Buffer — polish, re-record, submit', hours: 2, kind: 'work' },
  ];

  const DEADLINE = new Date(2026, 9, 8, 12, 0, 0); // 8 Oct 2026, 12:00 local time

  const ROOT = (document.body.dataset.root || '.').replace(/\/$/, '');
  const href = (file) => ROOT + '/' + file;

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };
  const progress = () => store.get('ccl-progress', {});
  const setDone = (id, done) => { const p = progress(); if (done) p[id] = true; else delete p[id]; store.set('ccl-progress', p); };

  const fmtMins = (m) => (m >= 60 ? (m / 60).toFixed(m % 60 ? 1 : 0).replace('.0', '') + ' h' : m + ' min');
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

  /* ---------------- Top bar ---------------- */
  function topbar() {
    const host = document.getElementById('topbar');
    if (!host) return;
    const cur = document.body.dataset.lesson;
    const p = progress();
    const done = COURSE.filter((c) => p[c.id]).length;
    host.innerHTML =
      '<a class="topbar__brand" href="' + href('index.html') + '"><span class="logo-dot"></span>Creative Code <em>in 48h</em></a>' +
      '<nav class="topbar__nav">' +
      '  <details class="lesson-menu"><summary>Lessons <span class="muted">(' + done + '/' + COURSE.length + ')</span></summary><ol></ol></details>' +
      '  <a href="' + href('reference.html') + '">Cheat sheet</a>' +
      '  <a href="' + href('studio.html') + '">Studio</a>' +
      '</nav>';
    const ol = host.querySelector('ol');
    COURSE.forEach((c) => {
      const li = el('li', (c.id === cur ? 'is-current ' : '') + (p[c.id] ? 'is-done' : ''));
      li.innerHTML = '<a href="' + href(c.file) + '"><span class="num">' + c.id + '</span>' + c.title + '</a>';
      ol.appendChild(li);
    });
  }

  /* ---------------- Lesson footer: complete + prev/next ---------------- */
  function lessonFooter() {
    const host = document.getElementById('lesson-footer');
    const cur = document.body.dataset.lesson;
    if (!host || !cur) return;
    const i = COURSE.findIndex((c) => c.id === cur);
    const prev = COURSE[i - 1], next = COURSE[i + 1];
    const btn = el('button', 'btn btn--big');
    const paint = () => {
      const d = !!progress()[cur];
      btn.textContent = d ? '✓ Completed — click to undo' : 'Mark this lesson complete';
      btn.classList.toggle('btn--done', d);
    };
    btn.addEventListener('click', () => { setDone(cur, !progress()[cur]); paint(); topbar(); });
    paint();
    host.className = 'lesson-footer';
    host.appendChild(btn);
    const nav = el('div', 'lesson-footer__nav');
    nav.innerHTML =
      (prev ? '<a class="pn pn--prev" href="' + href(prev.file) + '"><small>← Previous</small>' + prev.title + '</a>' : '<span></span>') +
      (next ? '<a class="pn pn--next" href="' + href(next.file) + '"><small>Next →</small>' + next.title + '</a>' : '<a class="pn pn--next" href="' + href('index.html') + '"><small>Done →</small>Back to the course map</a>');
    host.appendChild(nav);

    // Lesson header meta
    const meta = document.getElementById('lesson-meta');
    if (meta && i >= 0) meta.textContent = COURSE[i].phase + ' · ' + (COURSE[i].id.startsWith('P') ? '' : 'Lesson ' + COURSE[i].id + ' · ') + '≈ ' + fmtMins(COURSE[i].mins);
  }

  /* ---------------- Checklists (milestones) ---------------- */
  function checklists() {
    document.querySelectorAll('[data-checklist]').forEach((list) => {
      const key = 'ccl-check-' + list.dataset.checklist;
      const state = store.get(key, {});
      list.querySelectorAll('li').forEach((li, idx) => {
        const box = el('input');
        box.type = 'checkbox';
        box.checked = !!state[idx];
        box.setAttribute('aria-label', 'Done');
        box.addEventListener('change', () => { const s = store.get(key, {}); s[idx] = box.checked; store.set(key, s); li.classList.toggle('is-checked', box.checked); });
        li.classList.toggle('is-checked', box.checked);
        li.prepend(box);
      });
    });
  }

  /* ---------------- Home page: course map, planner, countdown ---------------- */
  function home() {
    const map = document.getElementById('course-map');
    if (!map) return;
    const p = progress();
    let phase = '';
    let section;
    COURSE.forEach((c) => {
      if (c.phase !== phase) {
        phase = c.phase;
        const h = el('h3', 'phase-title', phase);
        map.appendChild(h);
        section = el('div', 'cards');
        map.appendChild(section);
      }
      const a = el('a', 'card' + (p[c.id] ? ' is-done' : '') + (c.id.startsWith('P') ? ' card--project' : ''));
      a.href = href(c.file);
      a.innerHTML =
        '<div class="card__top"><span class="num">' + c.id + '</span><span class="card__time">' + fmtMins(c.mins) + '</span></div>' +
        '<h4>' + c.title + '</h4><p>' + c.blurb + '</p>' +
        '<span class="card__status">' + (p[c.id] ? '✓ Done' : 'Start →') + '</span>';
      section.appendChild(a);
    });

    const done = COURSE.filter((c) => p[c.id]);
    const total = COURSE.reduce((s, c) => s + c.mins, 0);
    const doneMins = done.reduce((s, c) => s + c.mins, 0);
    const bar = document.getElementById('progress-bar');
    if (bar) {
      bar.querySelector('.progress__fill').style.width = ((doneMins / total) * 100).toFixed(1) + '%';
      bar.querySelector('.progress__text').textContent = done.length + ' of ' + COURSE.length + ' steps complete · ' + fmtMins(total - doneMins) + ' of learning time left';
    }
    const resume = document.getElementById('resume');
    if (resume) {
      const nxt = COURSE.find((c) => !p[c.id]);
      resume.href = href(nxt ? nxt.file : COURSE[0].file);
      resume.textContent = done.length === 0 ? 'Start lesson 00 →' : nxt ? 'Continue: ' + nxt.title + ' →' : 'All done — review →';
    }

    planner();
    countdown();
  }

  function planner() {
    const host = document.getElementById('planner');
    if (!host) return;
    const input = document.getElementById('start-time');
    const toLocalInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    let start = store.get('ccl-start', null);
    input.value = start ? start : toLocalInput(new Date());
    const render = () => {
      const s = new Date(input.value);
      if (isNaN(s)) return;
      const p = progress();
      let t = s.getTime();
      const rows = PLAN.map((b) => {
        const from = new Date(t);
        t += b.hours * 3600000;
        const to = new Date(t);
        const late = to > DEADLINE;
        const items = (b.items || []).map((id) => {
          const c = COURSE.find((x) => x.id === id);
          return '<a href="' + href(c.file) + '" class="' + (p[id] ? 'is-done' : '') + '">' + (p[id] ? '✓ ' : '') + c.id + ' ' + c.title + '</a>';
        }).join('');
        const f = (d) => d.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
        return '<tr class="plan--' + b.kind + (late ? ' plan--late' : '') + '"><td class="plan__time">' + f(from) + ' – ' + f(to) + '</td><td><strong>' + b.label + '</strong>' + (items ? '<div class="plan__items">' + items + '</div>' : '') + '</td><td class="plan__hrs">' + b.hours + ' h</td></tr>';
      });
      const end = new Date(t);
      const slack = (DEADLINE - end) / 3600000;
      host.innerHTML = '<table class="plan"><tbody>' + rows.join('') + '</tbody></table>' +
        '<p class="plan__summary ' + (slack < 0 ? 'is-late' : '') + '">' +
        (slack >= 0
          ? 'Plan finishes ' + end.toLocaleString([], { weekday: 'long', hour: 'numeric', minute: '2-digit' }) + ' — ' + slack.toFixed(1) + ' h before the deadline. 👍'
          : 'This plan ends ' + (-slack).toFixed(1) + ' h after the deadline. Start earlier, shorten the sleep blocks a little (not below 6h), or trim Block F — rows in red run past noon on Oct 8.') +
        '</p>';
    };
    input.addEventListener('change', () => { store.set('ccl-start', input.value); render(); });
    document.getElementById('start-now').addEventListener('click', () => { input.value = toLocalInput(new Date()); store.set('ccl-start', input.value); render(); });
    render();
  }

  function countdown() {
    const host = document.getElementById('countdown');
    if (!host) return;
    const tick = () => {
      const ms = DEADLINE - new Date();
      if (ms <= 0) { host.textContent = 'Deadline reached — go submit! 🎉'; return; }
      const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
      host.innerHTML = '<strong>' + h + '</strong>h <strong>' + String(m).padStart(2, '0') + '</strong>m <strong>' + String(s).padStart(2, '0') + '</strong>s';
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---------------- Collapsible solutions ---------------- */
  function solutions() {
    document.querySelectorAll('details.solution > summary').forEach((s) => {
      if (!s.textContent.trim()) s.textContent = 'Show a possible solution';
    });
  }

  function init() { topbar(); lessonFooter(); checklists(); home(); solutions(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.CCL_COURSE = COURSE;
})();
