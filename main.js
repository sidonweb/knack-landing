// Knack landing page. No build step, no framework.

/**
 * Where every "Download" button and QR code points. Update it (and the matching `href`s in
 * index.html, which work without JavaScript) whenever a new version is released.
 */
const APK_URL = 'https://github.com/sidonweb/knack-mobile/releases/download/v1.1.0/knack-v1.1.0.apk';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.add('js');

// ─── Download links + QR codes ────────────────────────────────────────────

document.querySelectorAll('[data-download]').forEach((link) => {
  link.href = APK_URL;
});

function renderQr(el) {
  if (!el || typeof window.qrcode !== 'function') return;
  const qr = window.qrcode(0, 'M');
  qr.addData(APK_URL);
  qr.make();
  el.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  el.querySelector('svg')?.setAttribute('aria-hidden', 'true');
}

window.addEventListener('load', () => {
  renderQr(document.getElementById('qr-hero'));
  renderQr(document.getElementById('qr-download'));
});

// ─── Nav ──────────────────────────────────────────────────────────────────

const nav = document.getElementById('nav');
const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

document.getElementById('year').textContent = String(new Date().getFullYear());

// ─── Reveal on scroll ─────────────────────────────────────────────────────

const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      revealObserver.unobserve(entry.target);
    }
  },
  { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
);

// Stagger siblings that reveal together (steps, bento cards, FAQ rows).
document.querySelectorAll('.reveal').forEach((el) => {
  const siblings = [...el.parentElement.children].filter((child) => child.classList.contains('reveal'));
  const index = siblings.indexOf(el);
  if (siblings.length > 1) el.style.setProperty('--delay', `${Math.min(index, 6) * 70}ms`);
  revealObserver.observe(el);
});

const levelRing = document.querySelector('.level__ring');
if (levelRing) {
  new IntersectionObserver(([entry], observer) => {
    if (!entry.isIntersecting) return;
    levelRing.classList.add('is-in');
    observer.disconnect();
  }).observe(levelRing);
}

// ─── Consistency calendar + habit heatmap (seeded, so it looks the same every visit) ───

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function renderCalendar() {
  const el = document.getElementById('calendar');
  if (!el) return;
  // Six months on wide screens; the last four on phones, where 26 columns get too small.
  const weeks = window.matchMedia('(max-width: 599px)').matches ? 17 : 26;
  const rand = seeded(7);
  const cells = [];
  for (let w = 0; w < weeks; w++) {
    // The habit sticks over time: early weeks are patchy, recent ones mostly solid.
    const chance = 0.35 + (w / weeks) * 0.6;
    for (let d = 0; d < 7; d++) {
      const last = w === weeks - 1;
      if (last && d > 2) {
        cells.push('<i style="visibility:hidden"></i>');
        continue;
      }
      const r = rand();
      let cls = '';
      if (last && d === 2) cls = 'on today';
      else if (w > 8 && (d === 6 || d === 5) && r < 0.12) cls = 'rest';
      else if (r < chance) cls = r < chance * 0.25 ? 'on lo' : 'on';
      cells.push(`<i class="${cls}"></i>`);
    }
  }
  el.style.gridTemplateColumns = `repeat(${weeks}, 1fr)`;
  el.innerHTML = cells.join('');
}

function renderHeatmap() {
  const el = document.getElementById('heatmap');
  if (!el) return;
  const rand = seeded(23);
  const cells = [];
  for (let w = 0; w < 12; w++) {
    for (let d = 0; d < 7; d++) cells.push(`<i class="${rand() < 0.78 ? 'on' : ''}"></i>`);
  }
  el.style.gridTemplateColumns = 'repeat(12, 1fr)';
  el.innerHTML = cells.join('');
}

renderCalendar();
renderHeatmap();

// ─── Interactive Today demo ───────────────────────────────────────────────
// Mirrors the app's scoring: weighted share of planned items done, 60 keeps the streak.

const WEIGHTS = { HIGH: 4, MEDIUM: 3, NONE: 2, LOW: 1 };
const FLAG = { HIGH: ['High', 'high'], MEDIUM: ['Med', 'med'], NONE: null, LOW: ['Low', 'low'] };
const MIN_SCORE = 60;
const BASE_STREAK = 12;
const BASE_XP = 1240;

const initialItems = () => [
  { id: 'read', kind: 'habit', title: 'Read', meta: '20 min', icon: 'book', color: 'var(--iris)', priority: 'MEDIUM', done: true },
  { id: 'gym', kind: 'habit', title: 'Workout', meta: '45 min', icon: 'barbell', color: 'var(--sky)', priority: 'HIGH', done: false },
  { id: 'calm', kind: 'habit', title: 'Meditate', meta: '10 min', icon: 'leaf', color: 'var(--mint)', priority: 'NONE', done: false },
  { id: 't1', kind: 'task', title: 'Finish design review', priority: 'HIGH', done: false },
  { id: 't2', kind: 'task', title: 'Call mom', priority: 'MEDIUM', done: false },
  { id: 't3', kind: 'task', title: 'Groceries', priority: 'NONE', done: true },
  { id: 't4', kind: 'task', title: 'Clear inbox', priority: 'LOW', done: false },
];

let items = initialItems();
let shownScore = 0;
let xp = BASE_XP;
let wasSecured = false;
let wasPerfect = false;
let interacted = false;

const $ = (id) => document.getElementById(id);
const habitsEl = $('habits');
const tasksEl = $('tasks');

function scoreOf(list) {
  let earned = 0;
  let possible = 0;
  for (const item of list) {
    possible += WEIGHTS[item.priority];
    if (item.done) earned += WEIGHTS[item.priority];
  }
  return possible === 0 ? 0 : Math.floor((100 * earned) / possible);
}

function renderItems() {
  habitsEl.innerHTML = items
    .filter((item) => item.kind === 'habit')
    .map(
      (item) => `
        <button type="button" class="habit${item.done ? ' is-done' : ''}" data-id="${item.id}" style="--c:${item.color}"
          aria-pressed="${item.done}" aria-label="${item.title}, ${item.done ? 'done' : 'not done'}">
          <span class="habit__ic"><svg class="i"><use href="#i-${item.done ? 'check' : item.icon}"/></svg></span>
          <span class="habit__name">${item.title}</span>
          <span class="habit__meta">${item.meta}</span>
        </button>`,
    )
    .join('');

  tasksEl.innerHTML = items
    .filter((item) => item.kind === 'task')
    .map((item) => {
      const flag = FLAG[item.priority];
      return `
        <li>
          <button type="button" class="task${item.done ? ' is-done' : ''}" data-id="${item.id}"
            aria-pressed="${item.done}" aria-label="${item.title}, ${item.done ? 'done' : 'not done'}">
            <span class="cb${item.done ? ' is-done' : ''}"><svg class="i"><use href="#i-check"/></svg></span>
            <span class="task__title">${item.title}</span>
            ${flag ? `<span class="flag flag--${flag[1]}">${flag[0]}</span>` : ''}
          </button>
        </li>`;
    })
    .join('');
}

function animateNumber(el, from, to, duration = 600) {
  if (reduceMotion || from === to) {
    el.textContent = String(to);
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = String(Math.round(from + (to - from) * eased));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function capsule(html, tone = '') {
  const el = document.createElement('div');
  el.className = `capsule${tone ? ` capsule--${tone}` : ''}`;
  el.innerHTML = html;
  $('capsules').appendChild(el);
  setTimeout(() => el.remove(), 1900);
}

function renderScore() {
  const score = scoreOf(items);
  const remaining = items.filter((item) => !item.done).length;
  const secured = score >= MIN_SCORE;
  const perfect = score === 100;

  animateNumber($('score'), shownScore, score);
  shownScore = score;
  $('ring-fill').style.strokeDashoffset = String(263.89 * (1 - score / 100));
  $('ring').classList.toggle('is-perfect', perfect);

  $('score-title').textContent = perfect ? 'Perfect day' : secured ? 'Streak secured' : `${MIN_SCORE} keeps your streak`;
  $('score-sub').textContent = perfect ? 'Everything done. Enjoy tonight.' : `${remaining} left today`;

  const streak = $('streak');
  streak.classList.toggle('is-lit', secured);
  $('streak-count').textContent = String(secured ? BASE_STREAK + 1 : BASE_STREAK);

  if (interacted && secured && !wasSecured) capsule('<svg class="i"><use href="#i-flame"/></svg> 13-day streak', 'ember');
  if (interacted && perfect && !wasPerfect) {
    xp += 25;
    setTimeout(() => capsule('Perfect day <b>+25 XP</b>', 'mint'), 350);
    confetti();
    $('demo-reset').hidden = false;
  }
  if (!perfect && wasPerfect) xp -= 25;
  wasSecured = secured;
  wasPerfect = perfect;

  $('xp').textContent = xp.toLocaleString('en-US');
  $('xp-fill').style.width = `${Math.min(100, 42 + (xp - BASE_XP) / 2)}%`;
}

function toggle(id) {
  const item = items.find((entry) => entry.id === id);
  if (!item) return;
  item.done = !item.done;
  const gain = item.kind === 'habit' ? 15 : 10;
  xp += item.done ? gain : -gain;
  if (item.done) capsule(`${item.title} <b>+${gain} XP</b>`);

  if (!interacted) {
    interacted = true;
    document.getElementById('demo-hint')?.classList.add('is-hidden');
  }
  renderItems();
  renderScore();
}

$('demo').addEventListener('click', (event) => {
  const target = event.target.closest('[data-id]');
  if (target) toggle(target.dataset.id);
});

$('demo-reset').addEventListener('click', () => {
  items = initialItems();
  xp = BASE_XP;
  wasPerfect = false;
  wasSecured = false;
  interacted = false;
  $('demo-reset').hidden = true;
  renderItems();
  renderScore();
});

// Confetti: a short, soft burst inside the phone screen.
function confetti() {
  if (reduceMotion) return;
  const canvas = $('confetti');
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const styles = getComputedStyle(document.documentElement);
  const colors = ['--ember', '--mint', '--iris', '--sky', '--amber'].map((name) => styles.getPropertyValue(name).trim());
  const pieces = Array.from({ length: 90 }, () => ({
    x: rect.width / 2 + (Math.random() - 0.5) * 60,
    y: rect.height * 0.28,
    vx: (Math.random() - 0.5) * 9,
    vy: -Math.random() * 9 - 3,
    size: 4 + Math.random() * 5,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));

  const start = performance.now();
  const frame = (now) => {
    const elapsed = now - start;
    ctx.clearRect(0, 0, rect.width, rect.height);
    for (const p of pieces) {
      p.vy += 0.28;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - elapsed / 2200);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (elapsed < 2200) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, rect.width, rect.height);
  };
  requestAnimationFrame(frame);
}

renderItems();
renderScore();
