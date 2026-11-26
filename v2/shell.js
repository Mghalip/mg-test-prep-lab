'use strict';
/* MG Test Prep Lab · v2 shell (SAT / ACT / 数学).
   Reads results through the v1 cloud service (window.MG) and v1 storage keys; never writes to them. */
(() => {
const V2 = new URL('./', document.currentScript.src).href;
const ROOT = new URL('../', V2).href;
const UP = p => ROOT + p;
const PAGE = document.body.dataset.page || 'home';
const ACCOUNT = V2 + 'account.html';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SUBJECTS = ['sat', 'act', 'math'];

/* UI preferences only (subject, language). Learning data is handled below. */
const pref = {
  get(k, f) { try { return JSON.parse(localStorage.getItem('mg-v2-' + k)) ?? f; } catch { return f; } },
  set(k, v) { try { localStorage.setItem('mg-v2-' + k, JSON.stringify(v)); } catch {} }
};
/* Goals: kept for signed-in students (per account key); guests keep them for this visit only. */
const goalStore = {
  key: s => 'mg-v2-goal-' + s,
  get(s) {
    if (window.MG?.user) return MG.read(this.key(s), {});
    try { return JSON.parse(sessionStorage.getItem(this.key(s))) ?? {}; } catch { return {}; }
  },
  set(s, v) {
    if (window.MG?.user) return MG.write(this.key(s), v);
    try { sessionStorage.setItem(this.key(s), JSON.stringify(v)); } catch {}
  }
};

const legacySubject = { '#sat': 'sat', '#act': 'act', '#ap': 'math', '#ib': 'math', '#alevel': 'math' }[location.hash];
const qs = new URLSearchParams(location.search);
let subject = SUBJECTS.includes(qs.get('s')) ? qs.get('s') : legacySubject || pref.get('subject', 'sat');
let lang = ['zh', 'en'].includes(qs.get('lang')) ? qs.get('lang') : pref.get('lang', 'zh');
let route = legacySubject ? 'home' : location.hash.slice(1) || 'home';
let chip = 0;
const counts = { sat: 49, act: 9 };
const cache = { sat: null, act: null };

/* ---------- Icons ---------- */
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  list: '<path d="m3 6 2 2 3-3"/><path d="m3 15 2 2 3-3"/><path d="M12 7h9M12 16h9"/>',
  book: '<path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2z"/><path d="M22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
  layers: '<path d="m12 2 9 5-9 5-9-5 9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
  checkSq: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m9 12 2 2 4-4"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  type: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 15l3-8 3 8M10 12.5h4"/>',
  sigma: '<path d="M18 5H6l6 7-6 7h12"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  chev: '<path d="m6 9 6 6 6-6"/>',
  login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'
};
const icon = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;

/* ---------- Copy ---------- */
const T = {
  zh: {
    langBtn: 'EN', langName: '中文', subjectLabel: '当前板块', switchTitle: '切换板块', switchSub: '各科目成绩与目标分开记录。', current: '当前',
    nav: { home: '首页', practice: '练习', lessons: '课件', results: '成绩', plan: '学习计划', vocab: '词汇', formulas: '公式', mistakes: '错题本', more: '更多' },
    moreLabel: '工具', soon: '整理中', close: '关闭',
    signIn: '登录', signInSync: '登录同步进度', signOut: '退出登录', account: '学习账号',
    goal: '考试目标', edit: '修改', setDate: '设置考试日期', goalQ: '未设置考试日期',
    daysLeft: '天后考试', estimated: '最近预估', target: '目标分', testDay: '今天考试', past: '日期已过，请重新设置',
    estHintSat: '完成一套完整模考后生成预估分', estHintAct: '完成三科以上模考后生成综合分',
    estFrom: d => `来自 ${d} 模考`,
    guestGoal: '未登录时目标仅在当前页面有效',
    goalTitle: '考试目标', goalDate: '考试日期', goalScore: '目标分', save: '保存', cancel: '取消',
    practice: '练习入口', allPractice: '全部练习', lessons: '课程课件', allLessons: '全部课件',
    recent: '最近模考', recentEmpty: '暂无模考记录', allResults: '全部成绩',
    week: '近 7 天', stats: ['模考', '题数', '正确率', '练习天数'],
    days: ['日', '一', '二', '三', '四', '五', '六'], today: '今天',
    practiceSub: '模考按真实考场计时；专题练习按考点选题。',
    lessonsSub: '各科课件每周一 0:00 换密码，已批准账号可直接查看。',
    mathLessonsSub: 'AP / IB / A Level 讲义正在整理，上线后在此查看。',
    unlocked: '已解锁', needCode: '需本周密码', unlock: '解锁', codePh: '例如 7KQ-M4P',
    codeTitle: '输入本周密码解锁课件', codeSub: '密码每周一 0:00 更新，可向老师获取；注册并经批准后免密码。',
    codeSubUser: '输入老师提供的本周密码；账号获批后将自动解锁。',
    weekOpen: '本周已解锁', weekSub: d => `有效期至 ${d}`,
    approvedOpen: '已获得查看权限', approvedSub: '当前账号已由老师批准，可直接打开全部课件。',
    codeWrong: '密码不正确，请核对后重试。', codeWait: '尝试次数过多，请 10 分钟后再试。', codeAnon: '暂时无法验证密码，请联系老师。', codeNet: '网络连接失败，请稍后重试。',
    teacher: '教师后台', notices: '通知', unreadN: n => `${n} 条未读`,
    soonTitle: '该模块暂未开放', soonText: '当前可使用模考、专题练习与课件功能。', back: '返回首页',
    foot: '独立教学与备考平台，非 College Board、ACT, Inc.、IBO 或 Cambridge 官方网站。SAT®、AP® 为 College Board 注册商标，ACT® 为 ACT, Inc. 注册商标。',
    oldSite: '旧版首页',
    lessonsCount: n => `${n} 讲`,
    syncPending: n => `${n} 条成绩待同步`,
    mathStatus: '讲义整理中',
    mathCourseHeader: '课程目录'
  },
  en: {
    langBtn: '中', langName: 'English', subjectLabel: 'Program', switchTitle: 'Switch program', switchSub: 'Scores and goals are tracked separately per program.', current: 'Current',
    nav: { home: 'Home', practice: 'Practice', lessons: 'Lessons', results: 'Results', plan: 'Study plan', vocab: 'Vocabulary', formulas: 'Formulas', mistakes: 'Mistakes', more: 'More' },
    moreLabel: 'Tools', soon: 'In prep', close: 'Close',
    signIn: 'Sign in', signInSync: 'Sign in to sync', signOut: 'Sign out', account: 'Account',
    goal: 'Test goal', edit: 'Edit', setDate: 'Set test date', goalQ: 'No test date set',
    daysLeft: 'days left', estimated: 'Latest estimate', target: 'Target', testDay: 'Test day', past: 'Date passed — update goal',
    estHintSat: 'Complete a full mock to see a predicted score', estHintAct: 'Complete three core sections to see a composite',
    estFrom: d => `From ${d} mock`,
    guestGoal: 'Guest goals apply to this session only',
    goalTitle: 'Test goal', goalDate: 'Test date', goalScore: 'Target score', save: 'Save', cancel: 'Cancel',
    practice: 'Practice', allPractice: 'All practice', lessons: 'Lessons', allLessons: 'All lessons',
    recent: 'Recent mocks', recentEmpty: 'No completed mocks yet', allResults: 'All results',
    week: 'Last 7 days', stats: ['mocks', 'questions', 'accuracy', 'active days'],
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], today: 'Today',
    practiceSub: 'Timed full-length mocks and skill-based topic drills.',
    lessonsSub: 'Codes rotate every Monday at 00:00 (Beijing time). Approved accounts open lessons directly.',
    mathLessonsSub: 'AP, IB, and A Level notes are being compiled and will appear here.',
    unlocked: 'Unlocked', needCode: 'Code required', unlock: 'Unlock', codePh: 'e.g. 7KQ-M4P',
    codeTitle: 'Enter this week’s code', codeSub: 'Ask your teacher for this week’s code, or sign in with an approved account.',
    codeSubUser: 'Enter this week’s code, or wait for teacher approval on your account.',
    weekOpen: 'Unlocked this week', weekSub: d => `Valid until ${d}`,
    approvedOpen: 'Approved access', approvedSub: 'Your account has direct access to all lessons in this subject.',
    codeWrong: 'Incorrect code. Please check and try again.', codeWait: 'Too many attempts. Wait 10 minutes.', codeAnon: 'Code check unavailable right now.', codeNet: 'Network error. Please retry.',
    teacher: 'Teacher', notices: 'Notices', unreadN: n => `${n} unread`,
    soonTitle: 'Not available yet', soonText: 'Mocks, topic practice, and lessons are open.', back: 'Back to Home',
    foot: 'Independent teaching platform; not affiliated with the College Board, ACT, Inc., the IBO, or Cambridge. SAT® and AP® are registered trademarks of the College Board; ACT® is a registered trademark of ACT, Inc.',
    oldSite: 'Legacy home',
    lessonsCount: n => `${n} lessons`,
    syncPending: n => `${n} pending sync`,
    mathStatus: 'In preparation',
    mathCourseHeader: 'Course syllabus'
  }
};

/* ---------- Program content ---------- */
const C = {
  sat: {
    tile: '#EFF6FF', mark: 'SAT', short: 'SAT',
    name: { zh: 'SAT', en: 'SAT' },
    pageTitle: { zh: 'SAT 备考', en: 'SAT' },
    desc: { zh: '数字化 SAT：阅读语法与数学', en: 'Digital SAT: Reading & Writing, Math' },
    meta: (n, l) => lang === 'zh' ? `${n} 套模考，${l} 份课件` : `${n} mocks, ${l} lessons`,
    hero: {
      zh: {
        kicker: 'Digital SAT 模考系统',
        title: 'SAT 全真模考',
        desc: '98 题自适应分流，按真实考试计时，交卷后生成预估分与逐题解析。',
        cta: '进入模考',
        href: UP('mock.html'),
        chips: [
          ['完整模考', n => `${n} 套，约 2 小时 24 分钟`],
          ['Verbal 单科', () => '54 题，64 分钟'],
          ['Math 单科', () => '44 题，70 分钟']
        ]
      },
      en: {
        kicker: 'Digital SAT Simulator',
        title: 'SAT Mock Exams',
        desc: '98 adaptive questions under real timing, with predicted scores and item-by-item review.',
        cta: 'Open mock exams',
        href: UP('mock.html'),
        chips: [
          ['Full test', n => `${n} tests, ~2h 24m with break`],
          ['Reading & Writing', () => '54 questions, 64 min'],
          ['Math', () => '44 questions, 70 min']
        ]
      }
    },
    goal: { score: 1500, min: 400, max: 1600, step: 10 },
    practice: [
      { ic: 'timer', href: UP('mock.html'), zh: ['SAT 模考', n => `${n} 套完整卷与单科`], en: ['SAT Mock Exams', n => `${n} full tests and sections`] },
      { ic: 'layers', href: UP('sat.html'), zh: ['阅读与语法专题', () => '按题型专项刷题'], en: ['Topic Practice', () => 'Reading & writing skill drills'] },
      { ic: 'bookmark', href: UP('sat.html#wrong'), zh: ['错题重练', () => '集中复盘专题错题'], en: ['Mistake Review', () => 'Redo missed topic questions'] },
      { ic: 'chart', href: ACCOUNT, zh: ['成绩与逐题记录', () => '查看历史模考与错题分析'], en: ['Scores & Records', () => 'Mock history and item review'] }
    ]
  },
  act: {
    tile: '#F0FDFA', mark: 'ACT', short: 'ACT',
    name: { zh: 'ACT', en: 'ACT' },
    pageTitle: { zh: 'ACT 备考', en: 'ACT' },
    desc: { zh: '新版 ACT：English, Math, Reading, Science', en: 'Enhanced ACT: English, Math, Reading, Science' },
    meta: (n, l) => lang === 'zh' ? `${n} 套模考，${l} 份课件` : `${n} mocks, ${l} lessons`,
    hero: {
      zh: {
        kicker: 'Enhanced ACT 模考系统',
        title: 'ACT 全真模考',
        desc: '按新版 ACT 题量与时间作答，支持整套模考或单科计时训练。',
        cta: '进入模考',
        href: UP('act.html'),
        chips: [
          ['完整模考', n => `${n} 套，三科 2 小时 5 分钟起，科学可选`],
          ['English', () => '50 题，35 分钟'],
          ['Math', () => '45 题，50 分钟'],
          ['Reading', () => '36 题，40 分钟'],
          ['Science', () => '40 题，40 分钟']
        ]
      },
      en: {
        kicker: 'Enhanced ACT Simulator',
        title: 'Enhanced ACT Mocks',
        desc: 'Real question counts and timing. Take a full form or drill a single section.',
        cta: 'Open mock exams',
        href: UP('act.html'),
        chips: [
          ['Full test', n => `${n} forms, core three from 2h 5m`],
          ['English', () => '50 questions, 35 min'],
          ['Math', () => '45 questions, 50 min'],
          ['Reading', () => '36 questions, 40 min'],
          ['Science', () => '40 questions, 40 min']
        ]
      }
    },
    goal: { score: 33, min: 1, max: 36, step: 1 },
    practice: [
      { ic: 'timer', href: UP('act.html'), zh: ['ACT 模考', n => `${n} 套，支持单科训练`], en: ['ACT Mock Exams', n => `${n} forms, full or single section`] },
      { ic: 'chart', href: ACCOUNT, zh: ['成绩与逐题记录', () => '查看各科分数与综合分'], en: ['Scores & Records', () => 'Section scores and composites'] }
    ]
  },
  math: {
    tile: '#FFFBEB', mark: 'Σ', short: '数学',
    name: { zh: '数学', en: 'Math' },
    pageTitle: { zh: '国际课程数学', en: 'Math' },
    desc: { zh: 'AP / IB / A Level 课程讲义', en: 'AP / IB / A Level course notes' },
    meta: () => 'AP / IB / A Level',
    hero: {
      zh: {
        kicker: 'AP / IB / A Level',
        title: '国际课程数学',
        desc: '按课程与单元整理的讲义和习题，微积分等章节正在录入。'
      },
      en: {
        kicker: 'AP / IB / A Level',
        title: 'International Math',
        desc: 'Course notes and unit sets organized by syllabus. Calculus units are being prepared.'
      }
    },
    courses: [
      { id: 'ap-precalc', group: 'AP', zh: 'AP 初级微积分', en: 'AP Precalculus' },
      { id: 'ap-calcbc', group: 'AP', zh: 'AP 微积分 BC', en: 'AP Calculus BC' },
      { id: 'ib-aa', group: 'IB DP', zh: 'IB 数学 AA (SL / HL)', en: 'IB Math AA (SL / HL)' },
      { id: 'ib-ai', group: 'IB DP', zh: 'IB 数学 AI (SL / HL)', en: 'IB Math AI (SL / HL)' },
      { id: 'al-9709', group: 'Cambridge', zh: 'A Level 数学 9709', en: 'A Level Mathematics 9709' },
      { id: 'al-9231', group: 'Cambridge', zh: 'A Level 进阶数学 9231', en: 'A Level Further Math 9231' }
    ],
    practice: []
  }
};

/* ---------- Results (read-only) ---------- */
const satName = id => String(id ?? '').replace(/^A(\d+)$/, 'Practice $1');
const sum = (a, f) => a.reduce((n, x) => n + (f(x) || 0), 0);
function fromCloud(kind, r) {
  const items = Array.isArray(r.items) ? r.items : [];
  const s = r.summary || {};
  let est = null, label = '';
  if (kind === 'sat') {
    const p = s.prediction;
    if (s.scope === 'rw' || s.scope === 'math') { const c = p?.[s.scope]?.center; label = c ? `${s.scope === 'rw' ? 'Verbal' : 'Math'} ${c}` : '—'; }
    else { est = p?.total?.center ?? null; label = est ? `${est}` : '—'; }
  } else { est = Number.isFinite(s.composite) ? s.composite : null; label = est ? `${est}` : '—'; }
  return { when: Date.parse(r.submitted), title: kind === 'sat' ? satName(r.exam) : `ACT ${r.exam}`, est, label, answered: items.length, correct: items.filter(i => i.correct).length };
}
function fromLocal(kind, h) {
  if (kind === 'sat') {
    const scope = h.scope || 'full';
    let est = null, label = '—';
    if (typeof SatScore !== 'undefined') {
      if (scope === 'full') { est = SatScore.fromModules(h.results)?.total?.center ?? null; label = est ? `${est}` : '—'; }
      else { const c = SatScore.fromSectionModules(scope, h.results)?.center; label = c ? `${scope === 'rw' ? 'Verbal' : 'Math'} ${c}` : '—'; }
    }
    const res = Array.isArray(h.results) ? h.results : [];
    return { when: h.finished, title: satName(h.exam), est, label, answered: sum(res, r => r.total), correct: sum(res, r => r.correct) };
  }
  const secs = h.summary?.sections || [];
  const est = Number.isFinite(h.summary?.composite) ? h.summary.composite : null;
  return { when: h.finished, title: h.title || `ACT ${h.form}`, est, label: est ? `${est}` : '—', answered: sum(secs, s => s.total), correct: sum(secs, s => s.correct) };
}
function localHistory(kind) {
  if (kind === 'math') return [];
  if (cache[kind]) return cache[kind];
  try {
    return MG.read(kind === 'sat' ? 'sat-mock-history-v1' : 'mg-act-history-v1', [])
      .map(h => fromLocal(kind, h))
      .filter(x => Number.isFinite(x.when))
      .sort((a, b) => b.when - a.when);
  } catch { return []; }
}
async function loadHistory(kind) {
  if (kind === 'math') return [];
  if (cache[kind]) return cache[kind];
  await MG.ready;
  let list = [];
  try {
    if (MG.user && MG.available) list = (await MG.rows(kind + '-mock')).map(r => fromCloud(kind, r));
    else list = MG.read(kind === 'sat' ? 'sat-mock-history-v1' : 'mg-act-history-v1', []).map(h => fromLocal(kind, h));
  } catch { list = []; }
  list = list.filter(x => Number.isFinite(x.when)).sort((a, b) => b.when - a.when);
  cache[kind] = list;
  return list;
}
async function loadCounts() {
  const get = async (url, k) => { try { const r = await fetch(url); if (r.ok) { const d = await r.json(); if (Array.isArray(d) && d.length) counts[k] = d.length; } } catch {} };
  await Promise.all([get(UP('mock-data/manifest.json?v=20261120-months'), 'sat'), get(UP('act-data/manifest.json?v=20261114-scanned-forms2'), 'act')]);
}

/* ---------- Helpers ---------- */
const t = () => T[lang];
const L = o => o[lang];
const fmtDate = ms => new Date(ms).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });
const href = (s, r) => `${ROOT}?s=${s}${lang !== 'zh' ? '&lang=' + lang : ''}${r && r !== 'home' ? '#' + r : ''}`;
const isExternal = h => /^https?:/.test(h);

function navModel() {
  const n = t().nav;
  const main = [{ id: 'home', icon: 'home', label: n.home }];
  if (subject !== 'math') main.push({ id: 'practice', icon: 'list', label: n.practice });
  main.push({ id: 'lessons', icon: 'book', label: n.lessons });
  main.push({ id: 'results', icon: 'chart', label: n.results, href: ACCOUNT, current: PAGE === 'account' });
  const more = [];
  if (subject === 'sat') more.push({ id: 'mistakes', icon: 'bookmark', label: n.mistakes, href: UP('sat.html#wrong') });
  if (MG.teacher) more.push({ id: 'teacher', icon: 'edit', label: t().teacher, href: V2 + 'teacher.html' });
  return { main, more };
}
function navLink(it, cls) {
  const target = it.href || href(subject, it.id);
  const cur = it.current || (PAGE === 'home' && !it.href && route === it.id) ? ' aria-current="page"' : '';
  return `<a class="${cls}" href="${esc(target)}"${cur}>${icon(it.icon)}<span>${esc(it.label)}</span></a>`;
}

/* ---------- Chrome ---------- */
function userName() { const u = MG.user; return u ? (u.user_metadata?.display_name || u.email || '').trim() : ''; }
function renderChrome() {
  document.body.dataset.subject = subject;
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  const c = C[subject], tt = t(), nav = navModel();
  const pending = MG.user ? MG.read('mg-pending', []).length : 0;
  const unread = window.MGNotify ? MGNotify.unread(notifyCtx()) : 0;
  const acct = MG.user
    ? `<div class="row"><a class="user-chip" href="${ACCOUNT}"><span class="avatar">${esc(userName().slice(0, 1).toUpperCase() || 'M')}</span><span><strong>${esc(userName())}</strong><small>${esc(tt.account)}</small></span></a><button class="icon-btn" data-signout aria-label="${esc(tt.signOut)}" title="${esc(tt.signOut)}">${icon('logout')}</button></div>`
    : `<div class="row"><a class="btn btn-ghost btn-outline-full" href="${ACCOUNT}">${icon('login')}${esc(tt.signIn)}</a></div>`;
  document.getElementById('side').innerHTML = `
    <a class="brand" href="${href(subject)}"><img src="${UP('assets/mg-mark.svg')}" alt="" width="24" height="24"><b>MG Prep Lab</b></a>
    <div class="subj-seg" role="group" aria-label="${esc(tt.subjectLabel)}">${SUBJECTS.map(s =>
      `<button type="button" data-pick="${s}" aria-current="${s === subject}">${s === subject ? '<span class="dot" aria-hidden="true"></span>' : ''}${esc(L(C[s].name))}</button>`).join('')}</div>
    <nav class="side-nav">${nav.main.map(i => navLink(i, 'nav-item')).join('')}${nav.more.length ? `<div class="side-label">${esc(tt.moreLabel)}</div>${nav.more.map(i => navLink(i, 'nav-item')).join('')}` : ''}</nav>
    <div class="side-foot"><button class="nav-item bell-item" data-open="notify" aria-haspopup="dialog">${icon('bell')}<span>${esc(tt.notices)}</span>${unread ? `<span class="bell-count" aria-label="${esc(tt.unreadN(unread))}">${unread}</span>` : ''}</button>
      <button class="nav-item" data-lang aria-label="Language">${icon('globe')}<span>${esc(tt.langName)} / ${esc(tt.langBtn)}</span></button>
      ${acct}
      ${pending ? `<p class="sync-note">${esc(tt.syncPending(pending))}</p>` : ''}
    </div>`;
  document.getElementById('topbar').innerHTML = `
    <div class="l"><a href="${href(subject)}" aria-label="MG Test Prep Lab"><img src="${UP('assets/mg-mark.svg')}" alt="MG" width="24" height="24"></a>
      <button class="pill" data-open="switch" aria-haspopup="dialog"><span class="dot"></span>${esc(L(c.name))}${icon('chev')}</button></div>
    <div class="r"><button class="icon-btn bell-top" data-open="notify" aria-label="${esc(tt.notices)}${unread ? ' ' + esc(tt.unreadN(unread)) : ''}">${icon('bell')}${unread ? '<span class="dot-new"></span>' : ''}</button><button class="icon-btn" data-lang aria-label="Language">${esc(tt.langBtn)}</button>
      ${MG.user ? `<a class="icon-btn" href="${ACCOUNT}" aria-label="${esc(tt.account)}"><span class="avatar">${esc(userName().slice(0, 1).toUpperCase() || 'M')}</span></a>` : `<a class="icon-btn" href="${ACCOUNT}" aria-label="${esc(tt.signIn)}">${icon('login')}</a>`}</div>`;
  document.getElementById('tabbar').innerHTML = nav.main.map(i => navLink(i, 'tab')).join('') +
    `<button class="tab" data-open="more" aria-haspopup="dialog">${icon('menu')}<span>${esc(tt.nav.more)}</span></button>`;
}

/* ---------- Views ---------- */
function pageHeader(list) {
  const c = C[subject], tt = t(), g = goalStore.get(subject);
  const lessonTotal = subject === 'math' ? 0 : MGLessons.forSubject(subject).length;
  const meta = c.meta(counts[subject], lessonTotal);
  const actions = [];
  if (subject !== 'math' && !g.date) {
    actions.push(`<button class="btn btn-ghost btn-sm" data-open="goal">${icon('calendar')}${esc(tt.setDate)}</button>`);
  }
  if (!MG.user) {
    actions.push(`<a class="btn btn-ghost btn-sm" href="${ACCOUNT}">${esc(tt.signInSync)}</a>`);
  }
  return `<header class="page-head"><div><h1>${esc(L(c.pageTitle))}</h1><p class="meta num">${esc(meta)}</p></div>${actions.length ? `<div class="head-actions">${actions.join('')}</div>` : ''}</header>`;
}

function launchPanel() {
  const c = C[subject], h = L(c.hero);
  if (chip >= h.chips.length) chip = 0;
  const cur = h.chips[chip];
  const note = cur[1](counts[subject]);
  return `<section class="launch"><div class="launch-head"><p class="launch-kicker">${esc(h.kicker)}</p><h2>${esc(h.title)}</h2><p class="desc">${esc(h.desc)}</p></div>
    <div class="mode-tabs" role="group">${h.chips.map((x, i) => `<button type="button" class="chip" data-chip="${i}" aria-pressed="${i === chip}">${esc(x[0])}</button>`).join('')}</div>
    <div class="launch-foot"><a class="btn btn-primary btn-lg" href="${esc(h.href)}">${esc(h.cta)} ${icon('arrow')}</a><span class="note num">${esc(note)}</span></div></section>`;
}

function goalCard(list) {
  const tt = t(), g = goalStore.get(subject);
  const max = C[subject].goal.max, target = g.score || C[subject].goal.score;
  const latest = list.find(x => x.est != null);
  let dateBlock;
  if (g.date) {
    const days = Math.round((new Date(g.date + 'T00:00:00') - new Date(new Date().toDateString())) / 864e5);
    dateBlock = days > 0 ? `<div class="countdown"><strong>${days}</strong><span class="muted">${esc(tt.daysLeft)}</span></div><p class="hint">${esc(new Date(g.date + 'T00:00:00').toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }))}</p>`
      : `<p class="muted" style="margin:0">${esc(days === 0 ? tt.testDay : tt.past)}</p>`;
  } else {
    dateBlock = `<p class="hint">${esc(tt.goalQ)}</p>`;
  }
  const pct = latest ? Math.max(4, Math.min(100, Math.round(latest.est / target * 100))) : 0;
  return `<section class="card goal"><div class="card-head"><h3>${esc(tt.goal)}</h3><button class="link-btn" data-open="goal">${icon('edit')}${esc(tt.edit)}</button></div>
    ${dateBlock}
    <div class="score-row"><div><small>${esc(tt.estimated)}</small><strong>${latest ? latest.est : '—'}</strong></div>
      <div class="right"><small>${esc(tt.target)}</small><strong>${target}<span class="of"> / ${max}</span></strong></div></div>
    <div class="bar" role="img" aria-label="${pct}%"><span style="width:${pct}%"></span></div>
    <p class="hint">${esc(latest ? tt.estFrom(fmtDate(latest.when)) : subject === 'sat' ? tt.estHintSat : tt.estHintAct)}</p>
    ${MG.user ? '' : `<p class="hint">${esc(tt.guestGoal)}</p>`}</section>`;
}

function entryCard(p, title, desc) {
  return `<a class="entry-card" href="${esc(p.href)}"${isExternal(p.href) ? ' target="_blank" rel="noopener"' : ''}>
    <span class="ic">${icon(p.ic || 'file')}</span>
    <span class="txt"><strong>${esc(title)}</strong><small>${esc(desc)}</small></span>
    <span class="go">${icon('arrow')}</span></a>`;
}
function practiceEntries(limit) {
  const list = C[subject].practice.slice(0, limit || 99);
  return `<div class="entry-grid">${list.map(p => { const [a, b] = L(p); return entryCard(p, a, b(counts[subject])); }).join('')}</div>`;
}

function mathCatalog() {
  const tt = t(), h = L(C.math.hero);
  return `<p class="page-sub" style="margin:0">${esc(h.desc)}</p>
    <div class="list-group"><div class="catalog-head"><span>${esc(tt.mathCourseHeader)}</span><span>${esc(tt.mathStatus)}</span></div>
      ${C.math.courses.map(c => `<div class="list-row"><div><strong>${esc(L(c))}</strong></div><small>${esc(c.group)}</small></div>`).join('')}
    </div>`;
}

/* Home: one row per course. */
function courseRows(st) {
  if (subject === 'math') return '';
  const tt = t(), open = st?.[subject]?.can_view;
  return `<div class="list-group">${MGLessons.COURSES[subject].map(c => {
    const count = MGLessons.forCourse(subject, c.id).length;
    return `<a class="row-link" href="${href(subject, 'lessons')}">
      <span class="ic-sm">${icon('book')}</span>
      <span class="txt"><strong>${esc(L(c))}</strong></span>
      <span class="right-meta"><span class="num">${esc(tt.lessonsCount(count))}</span><span class="pill-status${open ? ' open' : ''}">${esc(open ? tt.unlocked : tt.needCode)}</span></span>
      <span class="go">${icon('arrow')}</span></a>`;
  }).join('')}</div>`;
}

/* Lessons page: unlock box + every lesson. */
function unlockBar(st) {
  const tt = t(), s = st?.[subject];
  if (s?.can_view) {
    const until = new Date(s.expires_at).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `<div class="unlock-bar"><div class="txt"><strong>${esc(s.approved ? tt.approvedOpen : tt.weekOpen)}</strong><small>${esc(s.approved ? tt.approvedSub : tt.weekSub(until))}</small></div><span class="badge-open">${esc(tt.unlocked)}</span></div>`;
  }
  return `<div class="unlock-bar"><div class="txt"><strong>${esc(tt.codeTitle)}</strong><small>${esc(MG.user ? tt.codeSubUser : tt.codeSub)}</small></div>
    <form class="code-form" id="unlock-form" autocomplete="off"><label class="sr-only" for="unlock-code">${esc(tt.codeTitle)}</label>
      <input id="unlock-code" name="code" autocapitalize="characters" spellcheck="false" maxlength="9" placeholder="${esc(tt.codePh)}" required>
      <button class="btn btn-primary" type="submit">${esc(tt.unlock)}</button></form>
    <p class="msg" id="unlock-msg" role="status" aria-live="polite" style="flex-basis:100%;margin:0"></p></div>`;
}
function lessonList(st) {
  if (subject === 'math') return mathCatalog();
  const open = st?.[subject]?.can_view;
  return MGLessons.COURSES[subject].map(c => `<section class="course-group"><h2>${esc(L(c))}</h2><div class="list-group lesson-list">
    ${MGLessons.forCourse(subject, c.id).map(i => `<a class="row-link" href="${V2}lesson.html?id=${encodeURIComponent(i.id)}"><span class="lesson-idx">${String(i.n).padStart(2, '0')}</span><span class="txt"><strong>${esc(i.title)}</strong>${lang === 'zh' && i.zh ? `<small>${esc(i.zh)}</small>` : ''}</span><span class="go">${open ? icon('arrow') : icon('lock')}</span></a>`).join('')}
  </div></section>`).join('');
}
async function lessonStatus() { try { lessonSt = await MGAccess.status(); } catch { lessonSt = {}; } return lessonSt; }

function recentCard(list) {
  const tt = t();
  const items = list.slice(0, 4);
  return `<section class="card"><div class="card-head"><h3>${esc(tt.recent)}</h3><a class="link-btn" href="${ACCOUNT}">${esc(tt.allResults)} ›</a></div>
    <ul class="recent">${items.map(r => `<li><span><strong>${esc(r.title)}</strong><small class="num">${esc(fmtDate(r.when))} · ${r.correct}/${r.answered}</small></span><span class="score">${esc(r.label)}</span></li>`).join('')}</ul></section>`;
}
function weekCard(list) {
  const tt = t();
  const start = new Date(new Date().toDateString()).getTime() - 6 * 864e5;
  const recent = list.filter(r => r.when >= start);
  const answered = sum(recent, r => r.answered), correct = sum(recent, r => r.correct);
  const active = new Set(recent.map(r => new Date(r.when).toDateString()));
  const days = [...Array(7)].map((_, i) => new Date(start + i * 864e5));
  return `<section class="card"><div class="card-head"><h3>${esc(tt.week)}</h3></div>
    <div class="stats"><div><strong>${recent.length}</strong><small>${esc(tt.stats[0])}</small></div><div><strong>${answered}</strong><small>${esc(tt.stats[1])}</small></div>
      <div><strong>${answered ? Math.round(correct / answered * 100) + '%' : '—'}</strong><small>${esc(tt.stats[2])}</small></div><div><strong>${active.size}/7</strong><small>${esc(tt.stats[3])}</small></div></div>
    <div class="days">${days.map((d, i) => `<span class="${i === 6 ? 'today' : ''}"><i class="${active.has(d.toDateString()) ? 'on' : ''}"></i>${esc(i === 6 ? tt.today : tt.days[d.getDay()])}</span>`).join('')}</div></section>`;
}
function foot() { return `<footer class="foot"><span>${esc(t().foot)}</span><a href="${UP('legacy.html')}">${esc(t().oldSite)}</a></footer>`; }

function viewHome() {
  const tt = t();
  const list = localHistory(subject), st = lessonSt;
  const g = goalStore.get(subject);
  const teacherBar = MG.teacher ? `<section class="staff-heading" aria-label="${esc(tt.teacher)}">
      <a id="pending-feedback" href="${UP('account.html?view=teacher')}">${lang === 'zh' ? '查看待反馈作业' : 'Review student submissions'}</a>
      <a href="${V2}teacher.html">${lang === 'zh' ? '课件与学生权限' : 'Lessons and access'}</a>
    </section>` : '';

  if (subject === 'math') {
    return `<div class="page">${pageHeader(list)}${teacherBar}${mathCatalog()}${foot()}</div>`;
  }

  const showGoal = list.length > 0 || Boolean(g.date);
  const topBlock = showGoal ? `<div class="top-grid">${launchPanel()}${goalCard(list)}</div>` : launchPanel();
  const historyBlock = list.length > 0 ? `<div class="two">${recentCard(list)}${weekCard(list)}</div>` : '';
  const lessonsBlock = `<section class="section-block"><div class="section-head"><h2>${esc(tt.lessons)}</h2><a class="link-btn" href="${href(subject, 'lessons')}">${esc(tt.allLessons)} ›</a></div>${courseRows(st)}</section>`;

  return `<div class="page">
    ${pageHeader(list)}
    ${teacherBar}
    ${topBlock}
    <section class="section-block"><div class="section-head"><h2>${esc(tt.practice)}</h2><a class="link-btn" href="${href(subject, 'practice')}">${esc(tt.allPractice)} ›</a></div>${practiceEntries(4)}</section>
    ${historyBlock}
    ${lessonsBlock}
    ${foot()}</div>`;
}
function viewPractice() {
  const tt = t();
  if (subject === 'math') return `<div class="page">${pageHeader([])}${mathCatalog()}${foot()}</div>`;
  return `<div class="page"><div><h1 class="page-title">${esc(tt.practice)}</h1><p class="page-sub">${esc(tt.practiceSub)}</p></div>${subject === 'sat' ? `<section class="study-entries" aria-label="${esc(tt.practice)}">
    <a class="study-main" href="${UP('mock.html')}"><small>SAT</small><h2>${lang === 'zh' ? '模考选卷' : 'Mock exams'}</h2><p>${counts.sat} ${lang === 'zh' ? '套，含完整模考与单科练习' : 'tests, full-length and sections'}</p></a>
    ${[['reading', '阅读', 'Reading'], ['grammar', '语法', 'Grammar']].map(([key, zh, en]) => `<a href="${UP('sat.html#' + key)}"><small>${lang === 'zh' ? '专题练习' : 'Topic practice'}</small><h2>${lang === 'zh' ? zh : en} →</h2></a>`).join('')}
  </section><div class="entry-grid">${C.sat.practice.slice(2).map(p => { const [a, b] = L(p); return entryCard(p, a, b(counts.sat)); }).join('')}</div>` : practiceEntries()}${foot()}</div>`;
}
function viewLessons() {
  const tt = t(), st = subject === 'math' ? {} : lessonSt;
  return `<div class="page"><div><h1 class="page-title">${esc(tt.lessons)}</h1><p class="page-sub">${esc(subject === 'math' ? tt.mathLessonsSub : tt.lessonsSub)}</p></div>${subject === 'math' ? '' : unlockBar(st)}${lessonList(st)}${foot()}</div>`;
}
function viewSoon(label) {
  const tt = t();
  return `<div class="page"><h1 class="page-title">${esc(label)}</h1><section class="card empty"><h2>${esc(tt.soonTitle)}</h2><p class="muted">${esc(tt.soonText)}</p><a class="btn btn-primary" href="${href(subject)}">${esc(tt.back)}</a></section>${foot()}</div>`;
}

let renderSeq = 0;
function paint() {
  if (subject === 'math' && route === 'practice') route = 'home';
  renderChrome();
  if (PAGE !== 'home') return;
  const view = document.getElementById('view');
  const n = t().nav;
  let html;
  if (route === 'practice') html = viewPractice();
  else if (route === 'lessons') html = viewLessons();
  else if (['plan', 'vocab', 'formulas', 'mistakes'].includes(route)) html = viewSoon(n[route]);
  else { route = 'home'; html = viewHome(); }
  view.innerHTML = html;
  const link = view.querySelector('#pending-feedback');
  if (link) refreshPendingFeedback(link);
}
async function hydrate(seq) {
  try { await MG.ready; } catch {}
  if (seq !== renderSeq) return;
  await Promise.allSettled([
    subject !== 'math' ? lessonStatus() : Promise.resolve(),
    loadHistory(subject)
  ]);
  if (seq !== renderSeq) return;
  try { await window.MGNotify?.refresh(notifyCtx()); } catch {}
  if (seq !== renderSeq) return;
  if (document.activeElement?.id === 'unlock-code') renderChrome();
  else paint();
}
function render() {
  const seq = ++renderSeq;
  paint();
  return hydrate(seq);
}

async function refreshPendingFeedback(link) {
  const zh = lang === 'zh';
  const workspace = UP('account.html?view=teacher');
  link.href = workspace;
  let count = 0, first;
  try {
    for (let offset = 0; link.isConnected; offset += 250) {
      const {data, error} = await MG.client.from('mg_reflections')
        .select('student_id,attempt_id,question_id,revision,mg_feedback(revision)')
        .order('updated_at').order('student_id').order('attempt_id').order('question_id')
        .range(offset, offset + 249);
      if (error) throw error;
      for (const row of data) {
        if (row.mg_feedback.some(feedback => feedback.revision === row.revision)) continue;
        count++;
        first ??= row;
      }
      if (data.length < 250) break;
    }
    if (!link.isConnected) return;
    if (first) {
      const url = new URL(workspace);
      url.searchParams.set('student', first.student_id);
      url.searchParams.set('attempt', first.attempt_id);
      url.searchParams.set('question', first.question_id);
      link.href = url.href;
    }
    link.textContent = zh ? (count ? `待反馈 ${count} 题 · 开始批改 →` : '暂无待反馈 · 查看学生成绩')
      : (count ? `Review pending submissions (${count}) →` : 'No pending feedback · View results');
  } catch {
    link.textContent = zh ? '待反馈数量读取失败 · 打开工作台' : 'Feedback count unavailable · Open workspace';
  }
}
window.addEventListener('pageshow', event => {
  const link = document.querySelector('#pending-feedback');
  if (event.persisted && link) refreshPendingFeedback(link);
});

/* ---------- Notifications ---------- */
let lessonSt = {};
function notifyCtx() {
  const goals = {};
  for (const s of ['sat', 'act']) goals[s] = goalStore.get(s);
  return { subject, lang, goals, lessonStatus: lessonSt, pending: MG.user ? MG.read('mg-pending', []).length : 0, signedIn: !!MG.user };
}

/* ---------- Dialogs ---------- */
function openDialog(id) {
  const tt = t(), d = document.getElementById('dlg-' + id);
  if (id === 'notify') {
    MGNotify.open(d, notifyCtx(), () => renderChrome());
    if (!d.open) d.showModal();
    return;
  }
  if (id === 'switch') {
    d.innerHTML = `<div class="panel"><div class="panel-head"><h2 id="dlg-switch-title">${esc(tt.switchTitle)}</h2><button class="icon-btn" data-close aria-label="${esc(tt.close)}">${icon('x')}</button></div>
      <p class="sub">${esc(tt.switchSub)}</p>
      ${SUBJECTS.map(s => `<a class="subj-opt" href="${href(s)}" data-pick="${s}"${s === subject ? ' aria-current="true"' : ''}><span class="tile" style="background:${C[s].tile}">${esc(C[s].mark)}</span><span class="txt"><strong>${esc(L(C[s].name))}</strong><small>${esc(L(C[s].desc))}</small></span>${s === subject ? `<span class="cur">${esc(tt.current)}</span>` : ''}</a>`).join('')}</div>`;
  } else if (id === 'more') {
    const nav = navModel();
    d.innerHTML = `<div class="panel"><div class="panel-head"><h2 id="dlg-more-title">${esc(tt.nav.more)}</h2><button class="icon-btn" data-close aria-label="${esc(tt.close)}">${icon('x')}</button></div>
      ${nav.more.length ? `<div class="more-grid">${nav.more.map(i => `<a href="${esc(i.href || href(subject, i.id))}" data-close>${icon(i.icon)}<strong>${esc(i.label)}</strong></a>`).join('')}</div>` : ''}
      <div class="list-box"><button data-switch-from-more>${esc(tt.switchTitle)}<span class="muted">${esc(L(C[subject].name))} ›</span></button>
        <button data-lang>语言 / Language<span class="muted">${esc(tt.langName)}</span></button>
        ${MG.user ? `<a href="${ACCOUNT}">${esc(tt.account)}<span class="muted">›</span></a><button data-signout>${esc(tt.signOut)}<span class="muted">${icon('logout')}</span></button>` : `<a href="${ACCOUNT}">${esc(tt.signIn)}<span class="muted">›</span></a>`}</div></div>`;
  } else if (id === 'goal') {
    const g = goalStore.get(subject), c = C[subject];
    d.innerHTML = `<form class="panel" method="dialog" id="goal-form"><div class="panel-head"><h2 id="dlg-goal-title">${esc(tt.goalTitle)}</h2><button type="button" class="icon-btn" data-close aria-label="${esc(tt.close)}">${icon('x')}</button></div>
      <label class="field">${esc(tt.goalDate)}<input type="date" name="date" value="${esc(g.date || '')}"></label>
      <label class="field">${esc(tt.goalScore)} (${c.goal.min}–${c.goal.max})<input type="number" name="score" min="${c.goal.min}" max="${c.goal.max}" step="${c.goal.step}" inputmode="numeric" value="${esc(g.score || c.goal.score)}"></label>
      ${MG.user ? '' : `<p class="hint">${esc(tt.guestGoal)}</p>`}
      <div class="acts"><button type="button" class="btn btn-ghost" data-close>${esc(tt.cancel)}</button><button type="submit" class="btn btn-primary">${esc(tt.save)}</button></div></form>`;
    d.querySelector('#goal-form').addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const raw = parseInt(f.get('score'), 10) || c.goal.score;
      const score = Math.min(c.goal.max, Math.max(c.goal.min, Math.round(raw / c.goal.step) * c.goal.step));
      goalStore.set(subject, { ...goalStore.get(subject), date: f.get('date') || '', score });
      d.close(); render();
    });
  }
  if (!d.open) d.showModal();
}

/* ---------- Events ---------- */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-open],[data-close],[data-lang],[data-chip],[data-signout],[data-pick],[data-switch-from-more]');
  if (!el) { if (e.target.tagName === 'DIALOG') e.target.close(); return; }
  if (el.matches('[data-open]')) { e.preventDefault(); openDialog(el.dataset.open); }
  else if (el.matches('[data-switch-from-more]')) { document.getElementById('dlg-more').close(); openDialog('switch'); }
  else if (el.matches('[data-pick]')) {
    e.preventDefault(); subject = el.dataset.pick; pref.set('subject', subject); chip = 0; route = 'home';
    el.closest('dialog')?.close();
    if (PAGE !== 'home') { location.href = href(subject); return; }
    window.history.replaceState(null, '', href(subject)); render(); window.scrollTo(0, 0);
  }
  else if (el.matches('[data-lang]')) {
    lang = lang === 'zh' ? 'en' : 'zh'; pref.set('lang', lang);
    if (PAGE === 'home') window.history.replaceState(null, '', href(subject, route));
    else document.dispatchEvent(new CustomEvent('mg-lang', { detail: lang }));
    document.querySelectorAll('dialog[open]').forEach(d => d.close()); render();
  }
  else if (el.matches('[data-chip]')) { chip = Number(el.dataset.chip); render(); }
  else if (el.matches('[data-signout]')) {
    el.disabled = true;
    try { await MG.sync(); const r = await MG.client.auth.signOut({ scope: 'local' }); if (r.error) throw r.error; location.reload(); }
    catch { el.disabled = false; alert(lang === 'zh' ? '退出失败，请重试。' : 'Sign-out failed. Please try again.'); }
  }
  else if (el.matches('[data-close]')) { el.closest('dialog')?.close(); }
});
document.addEventListener('submit', async e => {
  if (e.target.id !== 'unlock-form') return;
  e.preventDefault();
  const form = e.target, msg = document.getElementById('unlock-msg'), btn = form.querySelector('button'), tt = t();
  btn.disabled = true; msg.className = 'msg'; msg.textContent = '';
  try {
    const r = await MGAccess.unlock(subject, form.code.value);
    if (r === 'ok') { window.MGNotify?.rememberUnlock(subject); render(); return; }
    msg.className = 'msg err'; msg.textContent = r === 'wait' ? tt.codeWait : tt.codeWrong;
  } catch (err) { msg.className = 'msg err'; msg.textContent = err.code === 'anon' ? tt.codeAnon : tt.codeNet; }
  btn.disabled = false; form.code.select();
});
window.addEventListener('hashchange', () => {
  if (PAGE !== 'home') return; route = location.hash.slice(1) || 'home'; document.querySelectorAll('dialog[open]').forEach(d => d.close()); render(); window.scrollTo(0, 0); });

window.MGShell = { get lang() { return lang; }, get subject() { return subject; }, render, V2, ROOT };

/* ---------- Start ---------- */
pref.set('subject', subject);
const bootSeq = ++renderSeq;
paint();
loadCounts().then(() => {
  if (bootSeq === renderSeq && document.activeElement?.id !== 'unlock-code') paint();
}, () => {});
hydrate(bootSeq);
})();
