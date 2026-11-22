'use strict';
/* Notification panel: teacher notices + reminders the site works out by itself.
   Read state: signed-in students keep it on their account (user metadata, follows them across devices);
   guests keep it in this browser only. */
window.MGNotify = (() => {
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAY = 864e5;
const T = {
  zh: {
    title: '通知', markAll: '全部标为已读', all: '全部', unread: '未读', today: '今天', earlier: '更早', clear: '清空', empty: '暂时没有通知。',
    emptyUnread: '没有未读通知。', settings: '提醒设置', teacher: '老师通知', justNow: '刚刚',
    ago: ms => ms < 36e5 ? `${Math.max(1, Math.round(ms / 6e4))} 分钟前` : ms < DAY ? `${Math.round(ms / 36e5)} 小时前` : `${Math.round(ms / DAY)} 天前`,
    welcomeT: '欢迎来到 MG Test Prep Lab',
    welcomeGuest: 'SAT、ACT 模考和专题练习都可以免费用。注册免费账号后，成绩和错题会保存到账号里，换设备也能看。考试倒计时、老师通知和课件提醒都会出现在这里。',
    welcomeUser: '你的成绩会同步到这个账号。考试倒计时、老师通知和课件提醒都会出现在这里。',
    examT: (s, d) => d === 0 ? `今天考 ${s}，加油！` : `离 ${s} 考试还有 ${d} 天`,
    examB: (d) => d === 0 ? '带好证件，早点出发。' : d <= 1 ? '今天早点休息，明天按平时的节奏来。' : d <= 7 ? '最后一周：每天做一个模块保持手感，重点回顾错题。' : '还有一个月：可以开始每周一套完整模考，按时间做。',
    codeT: s => `本周 ${s} 课件密码已更换`,
    codeB: '每周一 0:00 换新密码，请向老师要本周的密码。注册并让老师批准后，就不用每周输入了。',
    syncT: n => `${n} 条成绩还没有同步`,
    syncB: '网络恢复后会自动同步；也可以打开"我的成绩"手动重试。别清除浏览器数据。',
    subj: { all: '全部', sat: 'SAT', act: 'ACT', math: '数学' }
  },
  en: {
    title: 'Notifications', markAll: 'Mark all read', all: 'All', unread: 'New', today: 'Today', earlier: 'Earlier', clear: 'Clear all', empty: 'No notifications yet.',
    emptyUnread: 'Nothing new.', settings: 'Settings', teacher: 'From your teacher', justNow: 'just now',
    ago: ms => ms < 36e5 ? `${Math.max(1, Math.round(ms / 6e4))} min ago` : ms < DAY ? `${Math.round(ms / 36e5)} h ago` : `${Math.round(ms / DAY)} d ago`,
    welcomeT: 'Welcome to MG Test Prep Lab',
    welcomeGuest: 'SAT and ACT mocks and topic practice are free. Create a free account to keep your scores and mistakes on any device. Test countdowns, teacher notices and lesson reminders show up here.',
    welcomeUser: 'Your results sync to this account. Test countdowns, teacher notices and lesson reminders show up here.',
    examT: (s, d) => d === 0 ? `${s} test day — good luck!` : `${d} day${d === 1 ? '' : 's'} until your ${s}`,
    examB: (d) => d === 0 ? 'Bring your ID and leave early.' : d <= 1 ? 'Rest early tonight and keep your usual pace tomorrow.' : d <= 7 ? 'Final week: one module a day to stay sharp, and review your mistakes.' : 'One month to go: start a full timed mock each week.',
    codeT: s => `This week’s ${s} lesson code has changed`,
    codeB: 'Codes change every Monday at 00:00 (Beijing time). Ask your teacher for the new one, or sign up and get approved to skip codes.',
    syncT: n => `${n} result${n === 1 ? '' : 's'} not synced yet`,
    syncB: 'They sync automatically when you are back online, or retry from My results. Don’t clear your browser data.',
    subj: { all: 'All', sat: 'SAT', act: 'ACT', math: 'Math' }
  }
};
const ICON = {
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 9a3 3 0 0 1 0 6M18 6a7 7 0 0 1 0 12"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 9.2-9.2M17 6l3 3M14 9l2 2"/>',
  cloud: '<path d="M17.5 19H8a5 5 0 1 1 .9-9.9A6 6 0 0 1 20 11a4 4 0 0 1-2.5 8z"/><path d="M12 12v4M12 18h.01"/>',
  check: '<path d="m2 13 4 4L16 7M9 15l2 2L21 7"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 11v6M14 11v6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>'
};
const icon = (n, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

/* ---------- read state ---------- */
const LOCAL = 'mg-v2-notify';
let state = { read: [], readAt: 0, clearedAt: 0 };
let notices = [], items = [], tab = 'all';
function loadState() {
  let s = null;
  if (window.MG?.user) s = MG.user.user_metadata?.mg_notify || null;
  else { try { s = JSON.parse(localStorage.getItem(LOCAL)); } catch {} }
  state = { read: Array.isArray(s?.read) ? s.read.slice(-150) : [], readAt: +s?.readAt || 0, clearedAt: +s?.clearedAt || 0 };
}
let saveTimer;
function saveState() {
  state.read = state.read.slice(-150);
  if (window.MG?.user && MG.client) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => MG.client.auth.updateUser({ data: { mg_notify: state } }).catch(() => {}), 400);
  } else { try { localStorage.setItem(LOCAL, JSON.stringify(state)); } catch {} }
}
const isRead = it => it.sticky ? false : (it.when <= state.readAt || state.read.includes(it.id));
const pref = (k, f) => { try { return JSON.parse(localStorage.getItem('mg-v2-' + k)) ?? f; } catch { return f; } };
const setPref = (k, v) => { try { localStorage.setItem('mg-v2-' + k, JSON.stringify(v)); } catch {} };

/* Monday 00:00 Beijing time of the current week, as a timestamp. */
function weekStart(now = Date.now()) {
  const bj = new Date(now + 8 * 36e5);
  const dow = (bj.getUTCDay() + 6) % 7;
  return Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate() - dow) - 8 * 36e5;
}

async function fetchNotices() {
  try {
    await MG.ready;
    if (!MG.client) return;
    const { data, error } = await MG.client.from('mg_notices').select('id,subject,title,body,created_at').order('created_at', { ascending: false }).limit(30);
    if (!error) notices = data || [];
  } catch {}
}

function build(ctx) {
  const t = T[ctx.lang], now = Date.now(), list = [];
  let first = pref('first-seen', 0);
  if (!first) { first = now; setPref('first-seen', first); }
  list.push({ id: 'welcome', kind: 'spark', when: first, title: t.welcomeT, body: ctx.signedIn ? t.welcomeUser : t.welcomeGuest });

  for (const n of notices) {
    if (n.subject !== 'all' && n.subject !== ctx.subject) continue;
    list.push({ id: 'n-' + n.id, kind: 'megaphone', when: Date.parse(n.created_at), title: n.title, body: n.body, tag: `${t.teacher} · ${t.subj[n.subject] || ''}` });
  }

  for (const s of ['sat', 'act']) {
    const date = ctx.goals?.[s]?.date;
    if (!date) continue;
    const exam = new Date(date + 'T00:00:00').getTime();
    const days = Math.round((exam - new Date(new Date().toDateString()).getTime()) / DAY);
    if (days < 0) continue;
    const step = [0, 1, 7, 30].find(x => days <= x);
    if (step === undefined) continue;
    const when = Math.min(now, exam - step * DAY + 8 * 36e5);
    list.push({ id: `exam-${s}-${date}-${step}`, kind: 'calendar', when, title: t.examT(s.toUpperCase(), days), body: t.examB(days) });
  }

  const used = pref('unlocked-subjects', []);
  for (const s of ['sat', 'act', 'math']) {
    if (!used.includes(s) || ctx.lessonStatus?.[s]?.approved) continue;
    const ws = weekStart(now);
    if (ws <= pref('first-unlock-' + s, 0)) continue;
    list.push({ id: `code-${s}-${ws}`, kind: 'key', when: ws, title: t.codeT(t.subj[s]), body: t.codeB });
  }

  if (ctx.pending > 0) list.push({ id: 'sync', kind: 'cloud', when: now, sticky: true, title: t.syncT(ctx.pending), body: t.syncB });

  items = list.filter(it => it.sticky || it.when > state.clearedAt).sort((a, b) => b.when - a.when);
  return items;
}

let fetched = false;
async function refresh(ctx) {
  loadState();
  if (!fetched) { fetched = true; await fetchNotices(); }
  build(ctx);
}
function unread(ctx) { if (!items.length) build(ctx); return items.filter(it => !isRead(it)).length; }

function open(dlg, ctx, onChange) {
  const t = T[ctx.lang];
  build(ctx);
  const draw = () => {
    const now = Date.now(), dayStart = new Date(new Date().toDateString()).getTime();
    const shown = tab === 'unread' ? items.filter(it => !isRead(it)) : items;
    const n = items.filter(it => !isRead(it)).length;
    const group = (label, list) => list.length ? `<p class="nt-group">${esc(label)}</p>${list.map(it => `
      <button class="nt-item${isRead(it) ? '' : ' is-new'}" data-nt="${esc(it.id)}">
        <span class="nt-dot" aria-hidden="true"></span>${icon(it.kind, 'i nt-ic')}
        <span class="nt-txt"><span class="nt-head"><strong>${esc(it.title)}</strong><small>${esc(now - it.when < 6e4 ? t.justNow : t.ago(now - it.when))}</small></span>
        ${it.tag ? `<small class="nt-tag">${esc(it.tag)}</small>` : ''}<span class="nt-body">${esc(it.body)}</span></span></button>`).join('')}` : '';
    dlg.innerHTML = `<div class="panel nt-panel" role="document">
      <div class="panel-head"><h2 id="dlg-notify-title">${esc(t.title)}</h2>
        <div class="nt-acts"><button class="link-btn" data-nt-all ${n ? '' : 'disabled'}>${icon('check')}${esc(t.markAll)}</button><button class="icon-btn" data-close aria-label="×">${icon('x')}</button></div></div>
      <div class="nt-tabs" role="tablist"><button role="tab" aria-selected="${tab === 'all'}" data-nt-tab="all">${esc(t.all)}</button><button role="tab" aria-selected="${tab === 'unread'}" data-nt-tab="unread">${esc(t.unread)}${n ? `<span class="nt-count">${n}</span>` : ''}</button></div>
      <div class="nt-list">${shown.length ? group(t.today, shown.filter(it => it.when >= dayStart)) + group(t.earlier, shown.filter(it => it.when < dayStart)) : `<p class="hint nt-empty">${esc(tab === 'unread' ? t.emptyUnread : t.empty)}</p>`}</div>
      <div class="nt-foot"><span></span><button class="link-btn" data-nt-clear ${items.some(it => !it.sticky) ? '' : 'disabled'}>${icon('trash')}${esc(t.clear)}</button></div></div>`;
  };
  dlg.onclick = e => {
    const b = e.target.closest('[data-nt],[data-nt-all],[data-nt-tab],[data-nt-clear]');
    if (!b) return;
    if (b.dataset.nt) { if (!state.read.includes(b.dataset.nt)) { state.read.push(b.dataset.nt); saveState(); } }
    else if (b.hasAttribute('data-nt-all')) { state.readAt = Date.now(); state.read = []; saveState(); }
    else if (b.dataset.ntTab) tab = b.dataset.ntTab;
    else if (b.hasAttribute('data-nt-clear')) { state.clearedAt = Date.now(); state.readAt = Date.now(); state.read = []; saveState(); build(ctx); }
    draw(); onChange?.();
  };
  dlg.classList.add('nt-dialog');
  draw();
}
function rememberUnlock(s) {
  const used = pref('unlocked-subjects', []);
  if (!used.includes(s)) { used.push(s); setPref('unlocked-subjects', used); setPref('first-unlock-' + s, Date.now()); }
}
return { refresh, unread, open, rememberUnlock, weekStart };
})();
