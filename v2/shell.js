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
  msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'
};
const icon = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;

const COURSE_STYLE = {
  reading: { cls: 'm-blue', dot: '#1865F2', ic: 'book' },
  writing: { cls: 'm-teal', dot: '#0D923F', ic: 'edit' },
  english: { cls: 'm-teal', dot: '#0D923F', ic: 'edit' },
  math:    { cls: 'm-purple', dot: '#7854F7', ic: 'sigma' }
};

/* ---------- Copy ---------- */
const T = {
  zh: {
    langBtn: 'EN', langName: '中文', subjectLabel: '当前板块', switchTitle: '切换板块', switchSub: '各科目成绩与目标分开记录。', current: '当前',
    nav: { home: '课程主页', practice: '练习与模考', lessons: '全部课件', board: '讨论区', results: '我的成绩', plan: '学习计划', vocab: '词汇', formulas: '公式', mistakes: '错题本', more: '更多' },
    tab: { home: '首页', practice: '练习', lessons: '课件', board: '讨论', results: '成绩', more: '更多' },
    moreLabel: '工具', courseDirLabel: '课程目录', soon: '整理中', close: '关闭',
    signIn: '登录', signInSync: '登录同步成绩', signOut: '退出登录', account: '学习账号',
    goal: '考试目标', overviewTitle: '学习概览', edit: '修改', setDate: '设置考试日期', goalQ: '未设置考试日期',
    daysLeft: '天后考试', estimated: '最近预估', target: '目标分', testDay: '今天考试', past: '日期已过，请重新设置',
    estHintSat: '完成一套完整模考后生成预估分', estHintAct: '完成三科以上模考后生成综合分',
    estFrom: d => `来自 ${d} 模考`,
    guestGoal: '未登录时目标仅在当前页面有效',
    goalTitle: '考试目标', goalDate: '考试日期', goalScore: '目标分', save: '保存', cancel: '取消',
    practice: '专项训练与工具', allPractice: '全部练习', lessons: '课程单元与课件', allLessons: '全部课件',
    startAction: '开始', viewAll: '查看全部',
    unitFoot: n => `共 ${n} 讲，点击任意一讲开始学习`,
    viewAllLessons: n => `查看全部 ${n} 讲`,
    recent: '最近模考', allResults: '全部成绩',
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
    mathStatus: '讲义整理中'
  },
  en: {
    langBtn: '中', langName: 'English', subjectLabel: 'Program', switchTitle: 'Switch program', switchSub: 'Scores and goals are tracked separately per program.', current: 'Current',
    nav: { home: 'Course Home', practice: 'Practice & Mocks', lessons: 'All Lessons', board: 'Board', results: 'My Results', plan: 'Study plan', vocab: 'Vocabulary', formulas: 'Formulas', mistakes: 'Mistakes', more: 'More' },
    tab: { home: 'Home', practice: 'Practice', lessons: 'Lessons', board: 'Board', results: 'Results', more: 'More' },
    moreLabel: 'Tools', courseDirLabel: 'Courses', soon: 'In prep', close: 'Close',
    signIn: 'Sign in', signInSync: 'Sign in to sync', signOut: 'Sign out', account: 'Account',
    goal: 'Test goal', overviewTitle: 'Course overview', edit: 'Edit', setDate: 'Set test date', goalQ: 'No test date set',
    daysLeft: 'days left', estimated: 'Latest estimate', target: 'Target', testDay: 'Test day', past: 'Date passed — update goal',
    estHintSat: 'Complete a full mock to see a predicted score', estHintAct: 'Complete three core sections to see a composite',
    estFrom: d => `From ${d} mock`,
    guestGoal: 'Guest goals apply to this session only',
    goalTitle: 'Test goal', goalDate: 'Test date', goalScore: 'Target score', save: 'Save', cancel: 'Cancel',
    practice: 'Practice & Tools', allPractice: 'All practice', lessons: 'Course Units & Lessons', allLessons: 'All lessons',
    startAction: 'Start', viewAll: 'View all',
    unitFoot: n => `${n} lessons — pick any lesson to begin`,
    viewAllLessons: n => `See all ${n} lessons`,
    recent: 'Recent mocks', allResults: 'All results',
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
    mathStatus: 'In preparation'
  }
};

/* ---------- Program content ---------- */
const C = {
  sat: {
    tile: '#1865F2', mark: 'SAT',
    name: { zh: 'SAT', en: 'SAT' },
    pageTitle: { zh: 'SAT 备考', en: 'SAT Prep' },
    desc: { zh: '数字化 SAT：阅读语法与数学', en: 'Digital SAT: Reading & Writing, Math' },
    meta: (n, l) => lang === 'zh' ? `${n} 套模考 · ${l} 讲课件` : `${n} mocks · ${l} lessons`,
    facts: n => lang === 'zh'
      ? [`${n} 套完整与单科真题模考`, '阅读与语法按考点专项刷题', '45 讲系统课程讲义']
      : [`${n} full-length & section mocks`, 'Skill-by-skill Reading & Writing drills', '45 structured course lessons'],
    hero: {
      zh: {
        kicker: 'Digital SAT 模考系统',
        title: 'SAT 备考课程与模考',
        desc: '98 题自适应分流，按真实考试计时，交卷后生成预估分与逐题解析。',
        cta: '进入模考',
        href: UP('mock.html'),
        chips: [
          ['完整模考', n => `${n} 套，约 2 小时 24 分钟`, UP('mock.html')],
          ['Verbal 单科', () => '54 题，64 分钟', UP('mock.html?view=rw')],
          ['Math 单科', () => '44 题，70 分钟', UP('mock.html?view=math')]
        ]
      },
      en: {
        kicker: 'Digital SAT Simulator',
        title: 'SAT Prep & Mock Exams',
        desc: '98 adaptive questions under real timing, with predicted scores and item-by-item review.',
        cta: 'Open mock exams',
        href: UP('mock.html'),
        chips: [
          ['Full test', n => `${n} tests, ~2h 24m with break`, UP('mock.html')],
          ['Reading & Writing', () => '54 questions, 64 min', UP('mock.html?view=rw')],
          ['Math', () => '44 questions, 70 min', UP('mock.html?view=math')]
        ]
      }
    },
    goal: { score: 1500, min: 400, max: 1600, step: 10 },
    practice: [
      { ic: 'timer', mc: 'm-blue', href: UP('mock.html'), zh: ['SAT 模考', n => `${n} 套完整卷与单科`], en: ['SAT Mock Exams', n => `${n} full tests and sections`] },
      { ic: 'layers', mc: 'm-teal', href: UP('sat.html'), zh: ['阅读与语法专题', () => '按题型专项刷题'], en: ['Topic Practice', () => 'Reading & writing skill drills'] },
      { ic: 'bookmark', mc: 'm-amber', href: UP('sat.html#wrong'), zh: ['错题重练', () => '集中复盘专题错题'], en: ['Mistake Review', () => 'Redo missed topic questions'] },
      { ic: 'chart', mc: 'm-purple', href: ACCOUNT, zh: ['成绩与逐题记录', () => '查看历史模考与错题分析'], en: ['Scores & Records', () => 'Mock history and item review'] }
    ]
  },
  act: {
    tile: '#008A6E', mark: 'ACT',
    name: { zh: 'ACT', en: 'ACT' },
    pageTitle: { zh: 'ACT 备考', en: 'ACT Prep' },
    desc: { zh: '新版 ACT：English, Math, Reading, Science', en: 'Enhanced ACT: English, Math, Reading, Science' },
    meta: (n, l) => lang === 'zh' ? `${n} 套模考 · ${l} 讲课件` : `${n} mocks · ${l} lessons`,
    facts: n => lang === 'zh'
      ? [`${n} 套新版 ACT 全真卷`, '支持整套模考与单科计时练', '39 讲语法、阅读与数学课件']
      : [`${n} Enhanced ACT full forms`, 'Full-length or single-section timing', '39 English, Reading & Math lessons'],
    hero: {
      zh: {
        kicker: 'Enhanced ACT 模考系统',
        title: 'ACT 备考课程与模考',
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
        title: 'Enhanced ACT Prep & Mocks',
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
      { ic: 'timer', mc: 'm-teal', href: UP('act.html'), zh: ['ACT 模考', n => `${n} 套，支持单科训练`], en: ['ACT Mock Exams', n => `${n} forms, full or single section`] },
      { ic: 'chart', mc: 'm-purple', href: ACCOUNT, zh: ['成绩与逐题记录', () => '查看各科分数与综合分'], en: ['Scores & Records', () => 'Section scores and composites'] }
    ]
  },
  math: {
    tile: '#C75000', mark: 'Σ',
    name: { zh: '数学', en: 'Math' },
    pageTitle: { zh: '国际课程数学', en: 'International Math' },
    desc: { zh: 'AP / IB / A Level 课程讲义', en: 'AP / IB / A Level course notes' },
    meta: () => 'AP · IB DP · Cambridge',
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
    groups: [
      {
        id: 'ap', mc: 'm-blue', ic: 'sigma',
        title: { zh: 'AP · Advanced Placement', en: 'AP · Advanced Placement' },
        items: [
          { zh: 'AP 初级微积分 (AP Precalculus)', en: 'AP Precalculus' },
          { zh: 'AP 微积分 BC (AP Calculus BC)', en: 'AP Calculus BC' }
        ]
      },
      {
        id: 'ib', mc: 'm-teal', ic: 'layers',
        title: { zh: 'IB DP 数学', en: 'IB DP Mathematics' },
        items: [
          { zh: '分析与方法 AA · SL / HL', en: 'Analysis & Approaches · SL / HL' },
          { zh: '应用与解释 AI · SL / HL', en: 'Applications & Interpretation · SL / HL' }
        ]
      },
      {
        id: 'alevel', mc: 'm-amber', ic: 'book',
        title: { zh: 'Cambridge A Level', en: 'Cambridge A Level' },
        items: [
          { zh: '数学 Mathematics 9709', en: 'Mathematics 9709' },
          { zh: '进阶数学 Further Mathematics 9231', en: 'Further Mathematics 9231' }
        ]
      }
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
  const n = t().nav, tb = t().tab;
  const main = [{ id: 'home', icon: 'home', label: n.home, tab: tb.home }];
  if (subject !== 'math') main.push({ id: 'practice', icon: 'list', label: n.practice, tab: tb.practice });
  main.push({ id: 'lessons', icon: 'book', label: n.lessons, tab: tb.lessons });
  if (window.MGBoard) main.push({ id: 'board', icon: 'msg', label: n.board, tab: tb.board });
  main.push({ id: 'results', icon: 'chart', label: n.results, tab: tb.results, href: ACCOUNT, current: PAGE === 'account' });
  const more = [];
  if (subject === 'sat') more.push({ id: 'mistakes', icon: 'bookmark', label: n.mistakes, href: UP('sat.html#wrong') });
  if (MG.teacher) more.push({ id: 'teacher', icon: 'edit', label: t().teacher, href: V2 + 'teacher.html' });
  return { main, more };
}
function navLink(it, cls) {
  const target = it.href || href(subject, it.id);
  const isLessonsRoute = it.id === 'lessons' && (route === 'lessons' || route.startsWith('lessons-'));
  const cur = it.current || (PAGE === 'home' && !it.href && (route === it.id || isLessonsRoute)) ? ' aria-current="page"' : '';
  const text = cls === 'tab' && it.tab ? it.tab : it.label;
  return `<a class="${cls}" href="${esc(target)}"${cur}>${icon(it.icon)}<span>${esc(text)}</span></a>`;
}

/* ---------- Chrome ---------- */
function userName() { const u = MG.user; return u ? (u.user_metadata?.display_name || u.email || '').trim() : ''; }
function renderChrome() {
  document.body.dataset.subject = subject;
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  const c = C[subject], tt = t(), nav = navModel();
  const pending = MG.user ? MG.read('mg-pending', []).length : 0;
  const unread = window.MGNotify ? MGNotify.unread(notifyCtx()) : 0;
  const lessonTotal = subject === 'math' ? 0 : MGLessons.forSubject(subject).length;
  const sideMeta = c.meta(counts[subject], lessonTotal);
  const sideCourses = subject !== 'math' ? MGLessons.COURSES[subject] : [];

  const deskAcct = MG.user
    ? `<a class="user-chip desk-acct" href="${ACCOUNT}"><span class="avatar">${esc(userName().slice(0, 1).toUpperCase() || 'M')}</span><strong>${esc(userName())}</strong></a><button class="icon-btn desk-acct" data-signout aria-label="${esc(tt.signOut)}" title="${esc(tt.signOut)}">${icon('logout')}</button>`
    : `<a class="btn btn-primary btn-sm desk-acct" href="${ACCOUNT}">${esc(tt.signIn)}</a>`;

  const mobAcct = MG.user
    ? `<a class="icon-btn mob-acct" href="${ACCOUNT}" aria-label="${esc(tt.account)}"><span class="avatar">${esc(userName().slice(0, 1).toUpperCase() || 'M')}</span></a>`
    : `<a class="icon-btn mob-acct" href="${ACCOUNT}" aria-label="${esc(tt.signIn)}">${icon('login')}</a>`;

  document.getElementById('topbar').innerHTML = `
    <div class="top-l">
      <a class="brand" href="${href(subject)}" aria-label="MG Test Prep Lab"><img src="${UP('assets/mg-mark.svg?v=20261127-ka1')}" alt="MG" width="28" height="28"><b>MG Prep Lab</b></a>
      <div class="top-tabs" role="tablist" aria-label="${esc(tt.subjectLabel)}">${SUBJECTS.map(s =>
        `<button type="button" data-pick="${s}" aria-current="${s === subject}"><span class="dot" style="background:${C[s].tile}" aria-hidden="true"></span>${esc(L(C[s].name))}</button>`).join('')}</div>
      <button class="mob-switch" data-open="switch" aria-haspopup="dialog"><span class="dot"></span>${esc(L(c.name))}${icon('chev')}</button>
    </div>
    <div class="top-r">
      <button class="icon-btn bell-top" data-open="notify" aria-label="${esc(tt.notices)}${unread ? ' ' + esc(tt.unreadN(unread)) : ''}">${icon('bell')}${unread ? `<span class="dot-new"></span>` : ''}</button>
      <button class="lang-btn" data-lang aria-label="Language">${icon('globe')}<span class="lbl">${esc(tt.langName)} / </span>${esc(tt.langBtn)}</button>
      ${deskAcct}${mobAcct}
    </div>`;

  document.getElementById('side').innerHTML = `
    <div class="side-head"><strong>${esc(L(c.pageTitle))}</strong><small class="num">${esc(sideMeta)}</small></div>
    <nav class="side-nav">${nav.main.map(i => navLink(i, 'nav-item')).join('')}</nav>
    ${sideCourses.length ? `<div class="side-label">${esc(tt.courseDirLabel)}</div><div class="side-courses">${sideCourses.map(cs => {
      const st = COURSE_STYLE[cs.id] || COURSE_STYLE.reading;
      const n = MGLessons.forCourse(subject, cs.id).length;
      return `<a class="side-course" href="${href(subject, 'lessons-' + cs.id)}"><span class="cdot" style="background:${st.dot}"></span><span class="txt">${esc(L(cs))}</span><span class="cnt">${n}</span></a>`;
    }).join('')}</div>` : ''}
    ${nav.more.length ? `<div class="side-label">${esc(tt.moreLabel)}</div><nav class="side-nav">${nav.more.map(i => navLink(i, 'nav-item')).join('')}</nav>` : ''}
    ${pending ? `<p class="sync-note">${esc(tt.syncPending(pending))}</p>` : ''}`;

  document.getElementById('tabbar').innerHTML = nav.main.map(i => navLink(i, 'tab')).join('') +
    `<button class="tab" data-open="more" aria-haspopup="dialog">${icon('menu')}<span>${esc(tt.nav.more)}</span></button>`;
}

/* ---------- Views ---------- */
function goalBox(list) {
  const tt = t(), g = goalStore.get(subject), c = C[subject];
  const hasGoal = list.length > 0 || Boolean(g.date);
  if (!hasGoal) {
    return `<aside class="ka-goal-box"><div class="card-head"><h3>${esc(tt.overviewTitle)}</h3></div>
      <ul class="ka-fact-list">${c.facts(counts[subject]).map(f => `<li>${esc(f)}</li>`).join('')}</ul>
      <div class="ka-goal-actions"><button class="btn btn-ghost btn-sm" data-open="goal">${icon('calendar')}${esc(tt.setDate)}</button>
      ${MG.user ? '' : `<a class="link-btn" href="${ACCOUNT}">${esc(tt.signInSync)} ›</a>`}</div></aside>`;
  }
  const max = c.goal.max, target = g.score || c.goal.score;
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
  return `<aside class="ka-goal-box"><div class="card-head"><h3>${esc(tt.goal)}</h3><button class="link-btn" data-open="goal">${icon('edit')}${esc(tt.edit)}</button></div>
    ${dateBlock}
    <div class="score-row"><div><small>${esc(tt.estimated)}</small><strong>${latest ? latest.est : '—'}</strong></div>
      <div class="right"><small>${esc(tt.target)}</small><strong>${target}<span class="of"> / ${max}</span></strong></div></div>
    <div class="bar" role="img" aria-label="${pct}%"><span style="width:${pct}%"></span></div>
    <p class="hint">${esc(latest ? tt.estFrom(fmtDate(latest.when)) : subject === 'sat' ? tt.estHintSat : tt.estHintAct)}</p>
    ${MG.user ? '' : `<p class="hint">${esc(tt.guestGoal)}</p>`}</aside>`;
}

function kaBanner(list) {
  const c = C[subject], h = L(c.hero);
  if (subject === 'math') {
    return `<section class="ka-banner single"><div class="ka-banner-main"><p class="ka-kicker">${esc(h.kicker)}</p><h1>${esc(h.title)}</h1><p class="desc">${esc(h.desc)}</p></div></section>`;
  }
  if (chip >= h.chips.length) chip = 0;
  const cur = h.chips[chip];
  const note = cur[1](counts[subject]);
  const ctaHref = cur[2] || h.href;
  return `<section class="ka-banner">
    <div class="ka-banner-main">
      <p class="ka-kicker">${esc(h.kicker)}</p>
      <h1>${esc(h.title)}</h1>
      <p class="desc">${esc(h.desc)}</p>
      <div class="mode-tabs" role="group">${h.chips.map((x, i) => `<button type="button" class="chip" data-chip="${i}" aria-pressed="${i === chip}">${esc(x[0])}</button>`).join('')}</div>
      <div class="launch-foot"><a class="btn btn-primary btn-lg" href="${esc(ctaHref)}">${esc(h.cta)} ${icon('arrow')}</a><span class="note num">${esc(note)}</span></div>
    </div>
    ${goalBox(list)}
  </section>`;
}

function entryCard(p, title, desc) {
  const tt = t();
  return `<a class="entry-card" href="${esc(p.href)}"${isExternal(p.href) ? ' target="_blank" rel="noopener"' : ''}>
    <span class="medallion ${p.mc || 'm-blue'}">${icon(p.ic || 'file')}</span>
    <span class="txt"><strong>${esc(title)}</strong><small>${esc(desc)}</small></span>
    <span class="go">${esc(tt.startAction)} ›</span></a>`;
}
function practiceEntries(limit) {
  const list = C[subject].practice.slice(0, limit || 99);
  return `<div class="entry-grid">${list.map(p => { const [a, b] = L(p); return entryCard(p, a, b(counts[subject])); }).join('')}</div>`;
}

function mathCatalog() {
  const tt = t();
  return `<div class="math-grid">${C.math.groups.map(g => `<section class="unit-card">
    <div class="unit-head">
      <span class="medallion ${g.mc}">${icon(g.ic)}</span>
      <div class="txt"><h3>${esc(L(g.title))}</h3><div class="unit-meta"><span class="pill-status">${esc(tt.mathStatus)}</span></div></div>
    </div>
    <div class="list-group" style="border:none;border-radius:0;box-shadow:none">
      ${g.items.map(it => `<div class="list-row"><strong>${esc(L(it))}</strong><small>${esc(tt.soon)}</small></div>`).join('')}
    </div>
  </section>`).join('')}</div>`;
}

/* Home: Khan-style Course Unit Cards with direct lesson previews. */
function courseUnitCards(st) {
  if (subject === 'math') return '';
  const tt = t(), open = st?.[subject]?.can_view;
  return `<div class="unit-stack">${MGLessons.COURSES[subject].map(c => {
    const lessons = MGLessons.forCourse(subject, c.id);
    const preview = lessons.slice(0, 6);
    const stStyle = COURSE_STYLE[c.id] || COURSE_STYLE.reading;
    return `<section class="unit-card">
      <div class="unit-head">
        <span class="medallion ${stStyle.cls}">${icon(stStyle.ic)}</span>
        <div class="txt">
          <h3>${esc(L(c))}</h3>
          <div class="unit-meta"><span class="num">${esc(tt.lessonsCount(lessons.length))}</span><span class="pill-status${open ? ' open' : ''}">${esc(open ? tt.unlocked : tt.needCode)}</span></div>
        </div>
        <a class="link-btn" href="${href(subject, 'lessons-' + c.id)}">${esc(tt.viewAll)} ›</a>
      </div>
      <div class="unit-lessons">${preview.map(i => `<a class="unit-lesson-link" href="${V2}lesson.html?id=${encodeURIComponent(i.id)}">
        <span class="lesson-idx">${String(i.n).padStart(2, '0')}</span>
        <span class="txt"><strong>${esc(i.title)}</strong>${lang === 'zh' && i.zh ? `<small>${esc(i.zh)}</small>` : ''}</span>
        <span class="go">${open ? icon('arrow') : icon('lock')}</span></a>`).join('')}</div>
      <div class="unit-foot"><span>${esc(tt.unitFoot(lessons.length))}</span><a href="${href(subject, 'lessons-' + c.id)}">${esc(tt.viewAllLessons(lessons.length))} →</a></div>
    </section>`;
  }).join('')}</div>`;
}

/* Lessons page: unlock box + every lesson in Unit Cards. */
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
  const tt = t(), open = st?.[subject]?.can_view;
  return `<div class="unit-stack">${MGLessons.COURSES[subject].map(c => {
    const lessons = MGLessons.forCourse(subject, c.id);
    const stStyle = COURSE_STYLE[c.id] || COURSE_STYLE.reading;
    return `<section class="unit-card course-group" id="course-${esc(c.id)}">
      <div class="unit-head">
        <span class="medallion sm ${stStyle.cls}">${icon(stStyle.ic)}</span>
        <div class="txt"><h3>${esc(L(c))}</h3><div class="unit-meta"><span class="num">${esc(tt.lessonsCount(lessons.length))}</span></div></div>
      </div>
      <div class="lesson-list">${lessons.map(i => `<a class="row-link" href="${V2}lesson.html?id=${encodeURIComponent(i.id)}"><span class="lesson-idx">${String(i.n).padStart(2, '0')}</span><span class="txt"><strong>${esc(i.title)}</strong>${lang === 'zh' && i.zh ? `<small>${esc(i.zh)}</small>` : ''}</span><span class="go">${open ? icon('arrow') : icon('lock')}</span></a>`).join('')}</div>
    </section>`;
  }).join('')}</div>`;
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

function programStrip() {
  const tt = t();
  const shortDesc = {
    sat: lang === 'zh' ? `${counts.sat} 套模考` : `${counts.sat} mocks`,
    act: lang === 'zh' ? `${counts.act} 套模考` : `${counts.act} mocks`,
    math: 'AP · IB · AL'
  };
  return `<nav class="program-strip" aria-label="${esc(tt.subjectLabel)}">${SUBJECTS.map(s => {
    const c = C[s];
    const lt = s === 'math' ? 0 : MGLessons.forSubject(s).length;
    const active = s === subject;
    return `<button type="button" class="prog-card" data-pick="${s}" data-subj="${s}" aria-current="${active}">
      <span class="prog-badge">${esc(c.mark)}</span>
      <span class="prog-txt"><strong>${esc(L(c.name))}</strong><small class="desk-meta num">${esc(c.meta(counts[s], lt))}</small><small class="mob-meta num">${esc(shortDesc[s])}</small></span>
      ${active ? `<span class="prog-cur">${esc(tt.current)}</span>` : ''}
    </button>`;
  }).join('')}</nav>`;
}

function viewHome() {
  const tt = t();
  const list = cache[subject] || [], st = lessonSt;
  const teacherBar = MG.teacher ? `<section class="staff-heading" aria-label="${esc(tt.teacher)}">
      <a id="pending-feedback" href="${UP('account.html?view=teacher')}">${lang === 'zh' ? '查看待反馈作业' : 'Review student submissions'}</a>
      <a href="${V2}teacher.html">${lang === 'zh' ? '课件与学生权限' : 'Lessons and access'}</a>
    </section>` : '';

  if (subject === 'math') {
    return `<div class="page">${teacherBar}${programStrip()}${kaBanner(list)}${mathCatalog()}${foot()}</div>`;
  }

  const historyBlock = list.length > 0 ? `<div class="two">${recentCard(list)}${weekCard(list)}</div>` : '';
  const lessonsBlock = `<section class="section-block"><div class="section-head"><h2>${esc(tt.lessons)}</h2><a class="link-btn" href="${href(subject, 'lessons')}">${esc(tt.allLessons)} ›</a></div>${courseUnitCards(st)}</section>`;

  return `<div class="page">
    ${teacherBar}
    ${programStrip()}
    ${kaBanner(list)}
    <section class="section-block"><div class="section-head"><h2>${esc(tt.practice)}</h2><a class="link-btn" href="${href(subject, 'practice')}">${esc(tt.allPractice)} ›</a></div>${practiceEntries(4)}</section>
    ${historyBlock}
    ${lessonsBlock}
    ${foot()}</div>`;
}
function viewPractice() {
  const tt = t();
  if (subject === 'math') return viewHome();
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
  if (route === 'board' && window.MGBoard) {
    const ctx = { lang, subject, accountHref: ACCOUNT, footHtml: foot() };
    view.innerHTML = MGBoard.renderHtml(ctx);
    MGBoard.mount(view, ctx);
    return;
  }
  if (route === 'practice') html = viewPractice();
  else if (route === 'lessons' || route.startsWith('lessons-')) html = viewLessons();
  else if (['plan', 'vocab', 'formulas', 'mistakes'].includes(route)) html = viewSoon(n[route]);
  else { route = 'home'; html = viewHome(); }
  view.innerHTML = html;
  if (route.startsWith('lessons-')) {
    const cid = route.slice(8);
    document.getElementById('course-' + cid)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  const link = view.querySelector('#pending-feedback');
  if (link) refreshPendingFeedback(link);
}
async function hydrate(seq) {
  try { await MG.ready; } catch {}
  if (seq !== renderSeq) return;
  await Promise.allSettled([
    subject !== 'math' ? lessonStatus() : Promise.resolve(),
    loadHistory(subject),
    loadCounts()
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
    window.MGBoard?.setSubject?.(subject);
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
  if (PAGE !== 'home') return; route = location.hash.slice(1) || 'home'; document.querySelectorAll('dialog[open]').forEach(d => d.close()); render(); if (!route.startsWith('lessons-')) window.scrollTo(0, 0); });

window.MGShell = { get lang() { return lang; }, get subject() { return subject; }, render, V2, ROOT };

/* ---------- Start ---------- */
pref.set('subject', subject);
render();
})();
