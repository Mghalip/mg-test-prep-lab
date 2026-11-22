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

/* UI preferences only (subject, language, banner). Learning data is handled below. */
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
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
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
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'
};
const icon = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;

/* ---------- Copy ---------- */
const T = {
  zh: {
    langBtn: 'EN', langName: '中文', subjectLabel: '当前板块', switchTitle: '切换板块', switchSub: '每个板块的成绩和目标分开记录，随时切换。', current: '当前',
    nav: { home: '首页', practice: '练习', lessons: '课程', results: '我的成绩', plan: '学习计划', vocab: '词汇', formulas: '公式', mistakes: '错题本', more: '更多' },
    moreLabel: '更多', soon: '即将上线', close: '关闭',
    greet: h => h < 5 ? '夜深了' : h < 11 ? '早上好' : h < 13 ? '中午好' : h < 18 ? '下午好' : '晚上好',
    date: d => `<b>${d.getMonth() + 1}月${d.getDate()}日</b> · 星期${'日一二三四五六'[d.getDay()]}`,
    signIn: '登录', signUp: '注册免费账号', signOut: '退出登录', account: '学习账号',
    bannerTitle: '注册免费账号，保存你的进度',
    bannerText: '所有练习都可以免费用。登录后成绩会同步到账号，换手机、换电脑都能接着看；游客记录只留在这台设备的浏览器里。',
    startHere: '从这里开始',
    goal: '我的目标', edit: '修改', setDate: '设置考试日期', goalQ: '哪天考试？设好日期后这里开始倒计时。',
    daysLeft: '天后考试', estimated: '最近预估', target: '目标', testDay: '今天考试，加油！', past: '考试日期已过，可以设一个新的。',
    estHintSat: '做完一套完整模考后显示预估总分', estHintAct: '做完一套完整模考（三科）后显示综合分',
    estFrom: d => `来自 ${d} 的模考`,
    guestGoal: '游客模式下，目标只在本次打开期间有效。',
    goalTitle: '设置目标', goalDate: '考试日期', goalScore: '目标分', save: '保存', cancel: '取消', clear: '清除日期',
    course: '我的课程', courseQ: '选好课程后，首页优先显示它的课件。', open: '打开课件',
    practice: '练习', allPractice: '全部练习', lessons: '课程课件', allLessons: '全部课件',
    recent: '最近记录', recentEmpty: '还没有完成的模考。做完一套后，成绩会出现在这里。', allResults: '全部成绩',
    week: '最近 7 天', stats: ['完成次数', '答题数', '正确率', '练习天数'], weekEmpty: '这 7 天还没有记录。每练习一天，就会亮一格。',
    days: ['日', '一', '二', '三', '四', '五', '六'], today: '今天',
    practiceSub: '模考按真实考试流程计时；专题练习按考点选题。',
    lessonsSub: '课件每科一个密码，每周一 0:00 更换；老师批准过的注册学生不用密码。',
    mathLessonsSub: '微积分等课件正在准备，上线后会出现在这里。',
    unlocked: '已解锁', needCode: '需要本周密码', unlock: '解锁', codePh: '例如 7KQ-M4P',
    codeTitle: '输入本周密码，解锁这一科的全部课件', codeSub: '密码由老师提供，每周一 0:00 更换。注册后由老师批准，就不用每周输入了。',
    codeSubUser: '密码由老师提供。老师在后台批准你之后，这里会自动解锁，不用再输入。',
    weekOpen: '本周已解锁', weekSub: d => `有效到 ${d}，之后需要输入新一周的密码。`,
    approvedOpen: '老师已批准你查看这一科的课件', approvedSub: '登录这个账号就能看，不用密码。',
    codeWrong: '密码不对，请检查后再试。', codeWait: '尝试次数太多，请 10 分钟后再试。', codeAnon: '暂时无法验证密码，请联系老师。', codeNet: '网络连接失败，请稍后重试。',
    teacher: '教师后台', notices: '通知', unreadN: n => `${n} 条未读`,
    soonTitle: '这个功能正在做', soonText: '框架确认后会陆续上线。现在可以先用练习和课件。', back: '回到首页',
    foot: '独立教学与备考平台，非 College Board、ACT, Inc.、IBO 或 Cambridge 官方网站。SAT® 与 AP® 是 College Board 的注册商标，ACT® 是 ACT, Inc. 的注册商标。',
    oldSite: '旧版首页',
    lessonsCount: n => `${n} 份课件`,
    syncPending: n => `${n} 条成绩等待同步`
  },
  en: {
    langBtn: '中', langName: 'English', subjectLabel: 'Program', switchTitle: 'Switch program', switchSub: 'Each program keeps its own results and goals.', current: 'Current',
    nav: { home: 'Home', practice: 'Practice', lessons: 'Lessons', results: 'My results', plan: 'Study plan', vocab: 'Vocabulary', formulas: 'Formulas', mistakes: 'Mistakes', more: 'More' },
    moreLabel: 'More', soon: 'Soon', close: 'Close',
    greet: h => h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening',
    date: d => `<b>${d.toLocaleDateString('en-US', { weekday: 'long' })}</b>, ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
    signIn: 'Sign in', signUp: 'Create a free account', signOut: 'Sign out', account: 'Account',
    bannerTitle: 'Keep your progress with a free account',
    bannerText: 'Everything here is free to use. Signed in, your results sync to your account on any device; as a guest they stay in this browser only.',
    startHere: 'Start here',
    goal: 'Your goal', edit: 'Edit', setDate: 'Set your test date', goalQ: 'When is your test? Add the date to start a countdown.',
    daysLeft: 'days to go', estimated: 'Latest estimate', target: 'Goal', testDay: 'Test day — good luck!', past: 'That date has passed. Set a new one.',
    estHintSat: 'Finish a full mock to see a predicted total', estHintAct: 'Finish a full mock (three sections) to see a composite',
    estFrom: d => `From your mock on ${d}`,
    guestGoal: 'As a guest, your goal lasts for this visit only.',
    goalTitle: 'Set your goal', goalDate: 'Test date', goalScore: 'Goal score', save: 'Save', cancel: 'Cancel', clear: 'Clear date',
    course: 'Your course', courseQ: 'Pick a course and Home shows its lessons first.', open: 'Open lessons',
    practice: 'Practice', allPractice: 'All practice', lessons: 'Lessons', allLessons: 'All lessons',
    recent: 'Recent results', recentEmpty: 'No finished mocks yet. Your scores show up here after your first one.', allResults: 'All results',
    week: 'Last 7 days', stats: ['tests', 'questions', 'correct', 'days active'], weekEmpty: 'Nothing in the last 7 days. Each day you practice lights up here.',
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], today: 'Today',
    practiceSub: 'Mocks follow the real test timing; topic practice lets you pick skills.',
    lessonsSub: 'Each subject has its own code that changes every Monday at 00:00 (Beijing time). Approved registered students don’t need it.',
    mathLessonsSub: 'Calculus and other lessons are being prepared and will appear here.',
    unlocked: 'Unlocked', needCode: 'needs this week’s code', unlock: 'Unlock', codePh: 'e.g. 7KQ-M4P',
    codeTitle: 'Enter this week’s code to unlock every lesson in this subject', codeSub: 'Your teacher gives you the code; it changes every Monday. Once your teacher approves your account, you won’t need it.',
    codeSubUser: 'Your teacher gives you the code. Once your teacher approves you, lessons unlock here automatically.',
    weekOpen: 'Unlocked this week', weekSub: d => `Valid until ${d}; then you’ll need the new week’s code.`,
    approvedOpen: 'Your teacher approved you for this subject', approvedSub: 'Sign in with this account to open lessons — no code needed.',
    codeWrong: 'That code isn’t right. Check it and try again.', codeWait: 'Too many tries. Please wait 10 minutes.', codeAnon: 'Codes can’t be checked right now. Please contact your teacher.', codeNet: 'Connection failed. Please try again.',
    teacher: 'Teacher', notices: 'Notifications', unreadN: n => `${n} unread`,
    soonTitle: 'Coming soon', soonText: 'This arrives after the new layout is approved. Practice and lessons work now.', back: 'Back to Home',
    foot: 'Independent teaching and test-prep platform; not affiliated with the College Board, ACT, Inc., the IBO or Cambridge. SAT® and AP® are registered trademarks of the College Board; ACT® is a registered trademark of ACT, Inc.',
    oldSite: 'Previous home page',
    lessonsCount: n => `${n} lessons`,
    syncPending: n => `${n} result(s) waiting to sync`
  }
};

/* ---------- Program content ---------- */
const C = {
  sat: {
    tile: '#E8B04A', soft: '#FBF0D8', mark: 'SAT',
    name: { zh: 'SAT', en: 'SAT' }, desc: { zh: '数字化 SAT · 阅读语法 + 数学', en: 'Digital SAT · Reading & Writing + Math' },
    hero: {
      zh: { title: '用一套模考，看清你的起点', desc: '按真实流程做完 98 题，得到预估总分和两科分数区间，错题和逐题用时都整理好。', cta: '开始模考', href: UP('mock.html'),
        chips: [['完整模考', n => `${n} 套 · 约 2 小时 24 分钟（含休息）`], ['Verbal 单科', () => '54 题 · 64 分钟'], ['Math 单科', () => '44 题 · 70 分钟']] },
      en: { title: 'See where you stand with one full mock', desc: 'Work through all 98 questions on real timing and get a predicted total, section ranges, and every mistake sorted for review.', cta: 'Start a mock', href: UP('mock.html'),
        chips: [['Full test', n => `${n} tests · about 2 h 24 min with the break`], ['Reading & Writing', () => '54 questions · 64 min'], ['Math', () => '44 questions · 70 min']] }
    },
    goal: { score: 1500, min: 400, max: 1600, step: 10 },
    practice: [
      { g: 'M', href: UP('mock.html'), zh: ['SAT 模考', n => `${n} 套完整模考 · 自适应分流`], en: ['Mock exams', n => `${n} full-length tests · adaptive`] },
      { g: '专', href: UP('sat.html'), zh: ['专题练习', () => '阅读与语法考点 · 提交后看解析'], en: ['Topic practice', () => 'Reading & writing skills · explained answers'] },
      { g: '错', href: UP('sat.html'), zh: ['错题本', () => '在专题练习里重做错题'], en: ['Mistakes', () => 'Redo misses inside topic practice'] },
      { g: '绩', href: ACCOUNT, zh: ['我的成绩', () => '模考记录、逐题回顾'], en: ['My results', () => 'Mock history and question review'] }
    ]
  },
  act: {
    tile: '#4DB38A', soft: '#DFF2E9', mark: 'ACT',
    name: { zh: 'ACT', en: 'ACT' }, desc: { zh: '新版 ACT · English · Math · Reading · Science', en: 'Enhanced ACT · English · Math · Reading · Science' },
    hero: {
      zh: { title: '做一套新版 ACT，拿到第一个分数', desc: '按原卷题量和时间作答，交卷后看各科成绩和综合分（1–36）。可以整套做，也可以单科练。', cta: '开始模考', href: UP('act.html'),
        chips: [['完整模考', n => `${n} 套 · 三科 2 小时 5 分钟起，科推可选`], ['English', () => '50 题 · 35 分钟'], ['Math', () => '45 题 · 50 分钟'], ['Reading', () => '36 题 · 40 分钟'], ['Science', () => '40 题 · 40 分钟']] },
      en: { title: 'Take an Enhanced ACT and get your first score', desc: 'Work on each form’s real question counts and timing, then see section scores and a composite (1–36). Take the whole test or one section.', cta: 'Start a mock', href: UP('act.html'),
        chips: [['Full test', n => `${n} tests · core three from 2 h 5 min, Science optional`], ['English', () => '50 questions · 35 min'], ['Math', () => '45 questions · 50 min'], ['Reading', () => '36 questions · 40 min'], ['Science', () => '40 questions · 40 min']] }
    },
    goal: { score: 33, min: 1, max: 36, step: 1 },
    practice: [
      { g: 'M', href: UP('act.html'), zh: ['ACT 模考', n => `${n} 套 · 可单科训练`], en: ['Mock exams', n => `${n} tests · single-section practice`] },
      { g: '绩', href: ACCOUNT, zh: ['我的成绩', () => '模考记录、逐题回顾'], en: ['My results', () => 'Mock history and question review'] },
      { g: '专', soon: true, zh: ['专题练习', () => '按考点选题'], en: ['Topic practice', () => 'Pick skills to drill'] },
      { g: 'S', soon: true, zh: ['科推训练', () => '图表与实验题'], en: ['Science drills', () => 'Data and experiment questions'] }
    ]
  },
  math: {
    tile: '#EA8A63', soft: '#FCE6DC', mark: 'Σ',
    name: { zh: '数学', en: 'Math' }, desc: { zh: 'AP · IB · A Level', en: 'AP · IB · A Level' },
    hero: {
      zh: { title: '挑一门课，从第一单元开始', desc: '课件按课程和单元整理，微积分课件正在准备，上线后在这里打开。',
        chips: [['AP', () => 'AP 微积分课件即将上线', '#lessons', '查看 AP 课程'], ['IB', () => 'AA · AI 课件即将上线', '#lessons', '查看 IB 课程'], ['A Level', () => '9709 · 9231 课件即将上线', '#lessons', '查看 A Level 课程']] },
      en: { title: 'Pick a course and start with Unit 1', desc: 'Lessons are organized by course and unit. Calculus lessons are being prepared and will open here.',
        chips: [['AP', () => 'AP Calculus lessons coming soon', '#lessons', 'See AP courses'], ['IB', () => 'AA · AI lessons coming soon', '#lessons', 'See IB courses'], ['A Level', () => '9709 · 9231 lessons coming soon', '#lessons', 'See A Level courses']] }
    },
    courses: [
      { id: 'ap-precalc', zh: 'AP 初级微积分', en: 'AP Precalculus' },
      { id: 'ap-calcbc', zh: 'AP 微积分 BC', en: 'AP Calculus BC' },
      { id: 'ib-aa', zh: 'IB 数学 AA', en: 'IB Math AA' },
      { id: 'ib-ai', zh: 'IB 数学 AI', en: 'IB Math AI' },
      { id: 'al-9709', zh: 'A Level 数学 9709', en: 'A Level Mathematics 9709' },
      { id: 'al-9231', zh: 'A Level 进阶数学 9231', en: 'A Level Further Mathematics 9231' }
    ],
    practice: [
      { g: '练', soon: true, zh: ['章节练习', () => '按单元做题、自动批改'], en: ['Chapter practice', () => 'Unit questions, auto-checked'] },
      { g: '错', soon: true, zh: ['错题本', () => '做错的题自动收集'], en: ['Mistakes', () => 'Misses collected automatically'] }
    ],
    lessons: [
      { title: { zh: 'AP · Advanced Placement', en: 'AP · Advanced Placement' }, items: [
        { g: 'f', soon: true, zh: 'AP 初级微积分', en: 'AP Precalculus' },
        { g: '∫', soon: true, zh: 'AP 微积分 BC', en: 'AP Calculus BC' }
      ] },
      { title: { zh: 'IB DP 数学', en: 'IB DP Mathematics' }, items: [
        { g: 'AA', soon: true, zh: '分析与方法 AA · SL / HL', en: 'Analysis & Approaches · SL / HL' },
        { g: 'AI', soon: true, zh: '应用与解释 AI · SL / HL', en: 'Applications & Interpretation · SL / HL' }
      ] },
      { title: { zh: 'A Level · Cambridge', en: 'A Level · Cambridge' }, items: [
        { g: '9709', soon: true, zh: '数学 Mathematics 9709', en: 'Mathematics 9709' },
        { g: '9231', soon: true, zh: '进阶数学 Further Mathematics 9231', en: 'Further Mathematics 9231' }
      ] }
    ]
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
const GLYPH_EN = { '专': 'T', '错': '×', '绩': 'R', '读': 'R', '语': 'W', '数': 'M', '练': 'P', '课': 'C' };
const glyph = g => lang === 'en' ? (GLYPH_EN[g] || g) : g;

function navModel() {
  const n = t().nav;
  const main = [
    { id: 'home', icon: 'home', label: n.home },
    { id: 'practice', icon: 'list', label: n.practice },
    { id: 'lessons', icon: 'book', label: n.lessons },
    { id: 'results', icon: 'chart', label: n.results, href: ACCOUNT, current: PAGE === 'account' }
  ];
  const more = [
    { id: 'plan', icon: 'calendar', label: n.plan, soon: true },
    subject === 'math' ? { id: 'formulas', icon: 'sigma', label: n.formulas, soon: true } : { id: 'vocab', icon: 'type', label: n.vocab, soon: true },
    subject === 'sat' ? { id: 'mistakes', icon: 'bookmark', label: n.mistakes, href: UP('sat.html') } : { id: 'mistakes', icon: 'bookmark', label: n.mistakes, soon: true }
  ];
  if (MG.teacher) more.push({ id: 'teacher', icon: 'edit', label: n.teacher || t().teacher, href: V2 + 'teacher.html' });
  return { main, more };
}
function navLink(it, cls) {
  const target = it.href || href(subject, it.id);
  const cur = it.current || (PAGE === 'home' && !it.href && route === it.id) ? ' aria-current="page"' : '';
  return `<a class="${cls}" href="${esc(target)}"${cur}>${icon(it.icon)}<span>${esc(it.label)}</span>${it.soon && cls === 'nav-item' ? `<span class="soon">${esc(t().soon)}</span>` : ''}</a>`;
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
    : `<div class="row"><a class="btn btn-accent" href="${ACCOUNT}">${icon('login')}${esc(tt.signIn)}</a></div>`;
  document.getElementById('side').innerHTML = `
    <a class="brand" href="${href(subject)}"><img src="${UP('assets/mg-mark.svg')}" alt="" width="38" height="30"><b>MG <em>Prep</em> Lab</b></a>
    <button class="subject-btn" data-open="switch" aria-haspopup="dialog"><span class="dot"></span><span class="txt"><small>${esc(tt.subjectLabel)}</small><strong>${esc(L(c.name))}</strong></span>${icon('chev')}</button>
    <nav class="side-nav">${nav.main.map(i => navLink(i, 'nav-item')).join('')}<div class="side-label">${esc(tt.moreLabel)}</div>${nav.more.map(i => navLink(i, 'nav-item')).join('')}</nav>
    <div class="side-foot"><button class="nav-item bell-item" data-open="notify" aria-haspopup="dialog">${icon('bell')}<span>${esc(tt.notices)}</span>${unread ? `<span class="bell-count" aria-label="${esc(tt.unreadN(unread))}">${unread}</span>` : ''}</button>
      ${acct}
      ${pending ? `<p class="sync-note">${esc(tt.syncPending(pending))}</p>` : ''}
      <div class="row"><button class="icon-btn" data-lang aria-label="Language">${icon('globe')}</button><button class="lang-btn" data-lang>${esc(tt.langName)} · ${esc(tt.langBtn)}</button></div>
    </div>`;
  document.getElementById('topbar').innerHTML = `
    <div class="l"><a href="${href(subject)}" aria-label="MG Test Prep Lab"><img src="${UP('assets/mg-mark.svg')}" alt="MG" width="34" height="27"></a>
      <button class="pill" data-open="switch" aria-haspopup="dialog"><span class="dot"></span>${esc(L(c.name))}${icon('chev')}</button></div>
    <div class="r"><button class="icon-btn bell-top" data-open="notify" aria-label="${esc(tt.notices)}${unread ? ' · ' + esc(tt.unreadN(unread)) : ''}">${icon('bell')}${unread ? '<span class="dot-new"></span>' : ''}</button><button class="icon-btn" data-lang aria-label="Language">${esc(tt.langBtn)}</button>
      ${MG.user ? `<a class="icon-btn" href="${ACCOUNT}" aria-label="${esc(tt.account)}"><span class="avatar">${esc(userName().slice(0, 1).toUpperCase() || 'M')}</span></a>` : `<a class="icon-btn" href="${ACCOUNT}" aria-label="${esc(tt.signIn)}" style="color:var(--accent)">${icon('login')}</a>`}</div>`;
  document.getElementById('tabbar').innerHTML = nav.main.map(i => navLink(i, 'tab')).join('') +
    `<button class="tab" data-open="more" aria-haspopup="dialog">${icon('menu')}<span>${esc(tt.nav.more)}</span></button>`;
}

/* ---------- Views ---------- */
function banner() {
  if (MG.user || pref.get('banner-hidden', false)) return '';
  const tt = t();
  return `<section class="banner" aria-label="${esc(tt.bannerTitle)}"><span class="badge">${icon('save')}</span>
    <div class="txt"><strong>${esc(tt.bannerTitle)}</strong><p>${esc(tt.bannerText)}</p></div>
    <div class="acts"><a class="btn btn-ghost" href="${ACCOUNT}">${esc(tt.signIn)}</a><a class="btn btn-navy" href="${ACCOUNT}">${esc(tt.signUp)} ${icon('arrow')}</a>
    <button class="icon-btn" data-hide-banner aria-label="${esc(tt.close)}">${icon('x')}</button></div></section>`;
}
function hero() {
  const c = C[subject], h = L(c.hero), tt = t();
  if (chip >= h.chips.length) chip = 0;
  const cur = h.chips[chip];
  const note = cur[1](counts[subject]);
  const ctaHref = subject === 'math' ? cur[2] : h.href;
  const ctaText = subject === 'math' ? cur[3] : h.cta;
  return `<section class="hero"><p class="eyebrow">${esc(tt.startHere)}</p><h2>${esc(h.title)}</h2><p class="desc">${esc(h.desc)}</p>
    <div class="chips" role="group">${h.chips.map((x, i) => `<button class="chip" data-chip="${i}" aria-pressed="${i === chip}">${esc(x[0])}</button>`).join('')}</div>
    <div class="hero-cta"><a class="btn btn-accent btn-lg" href="${esc(ctaHref)}">${esc(ctaText)} ${icon('arrow')}</a><span class="note">${esc(note)}</span></div>
    <span class="mark" aria-hidden="true">${esc(c.mark)}</span></section>`;
}
function goalCard(list) {
  const tt = t(), g = goalStore.get(subject);
  if (subject === 'math') {
    const course = C.math.courses.find(x => x.id === g.course);
    return `<section class="card goal"><div class="card-head"><h3>${esc(tt.course)}</h3></div>
      <p class="hint">${esc(tt.courseQ)}</p>
      <label class="sr-only" for="course-select">${esc(tt.course)}</label>
      <select class="select" id="course-select">${['<option value="">—</option>', ...C.math.courses.map(x => `<option value="${x.id}"${x.id === g.course ? ' selected' : ''}>${esc(L(x))}${x.href ? '' : ' · ' + esc(tt.soon)}</option>`)].join('')}</select>
      ${course?.href ? `<a class="btn btn-ghost" href="${esc(course.href)}">${esc(tt.open)} ${icon('arrow')}</a>` : course ? `<p class="hint">${esc(tt.soonText)}</p>` : ''}
      ${MG.user ? '' : `<p class="hint">${esc(tt.guestGoal)}</p>`}</section>`;
  }
  const max = C[subject].goal.max, target = g.score || C[subject].goal.score;
  const latest = list.find(x => x.est != null);
  let dateBlock;
  if (g.date) {
    const days = Math.round((new Date(g.date + 'T00:00:00') - new Date(new Date().toDateString())) / 864e5);
    dateBlock = days > 0 ? `<div class="countdown"><strong>${days}</strong><span class="muted">${esc(tt.daysLeft)}</span></div><p class="hint">${esc(new Date(g.date + 'T00:00:00').toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }))}</p>`
      : `<p class="muted" style="margin:0">${esc(days === 0 ? tt.testDay : tt.past)}</p>`;
  } else {
    dateBlock = `<p class="muted" style="margin:0">${esc(tt.goalQ)}</p><div><button class="btn btn-ghost" data-open="goal">${esc(tt.setDate)}</button></div>`;
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
function rowLink(p, title, desc) {
  const tt = t();
  const inner = `<span class="glyph">${esc(glyph(p.g))}</span><span class="txt"><strong>${esc(title)}</strong><small>${esc(desc)}</small></span>${p.soon ? `<span class="tag-soon">${esc(tt.soon)}</span>` : `<span class="go">${icon('arrow')}</span>`}`;
  if (p.soon) return `<div class="row-link is-soon">${inner}</div>`;
  return `<a class="row-link" href="${esc(p.href)}"${isExternal(p.href) ? ' target="_blank" rel="noopener"' : ''}>${inner}</a>`;
}
function practiceRows(limit) {
  const list = C[subject].practice.slice(0, limit || 99);
  return `<div class="rows">${list.map(p => { const [a, b] = L(p); return rowLink(p, a, b(counts[subject])); }).join('')}</div>`;
}
function mathSoonGroups() {
  const tt = t();
  return C.math.lessons.map(g => `<section class="course-group"><h2>${esc(L(g.title))}</h2>
    <div class="rows">${g.items.map(i => rowLink(i, L(i), tt.soon)).join('')}</div></section>`).join('');
}
/* Home: one row per course. */
function courseRows(st) {
  if (subject === 'math') return mathSoonGroups();
  const tt = t(), open = st?.[subject]?.can_view;
  return `<div class="rows">${MGLessons.COURSES[subject].map(c => rowLink({ g: c.g, href: href(subject, 'lessons') }, L(c),
    `${tt.lessonsCount(MGLessons.forCourse(subject, c.id).length)} · ${open ? tt.unlocked : tt.needCode}`)).join('')}</div>`;
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
      <button class="btn btn-navy" type="submit">${esc(tt.unlock)}</button></form>
    <p class="msg" id="unlock-msg" role="status" aria-live="polite" style="flex-basis:100%;margin:0"></p></div>`;
}
function lessonList(st) {
  if (subject === 'math') return mathSoonGroups();
  const open = st?.[subject]?.can_view;
  const lock = `<svg class="i lock-i" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;
  return MGLessons.COURSES[subject].map(c => `<section class="course-group"><h2>${esc(L(c))}</h2><div class="lesson-list">
    ${MGLessons.forCourse(subject, c.id).map(i => `<a class="row-link" href="${V2}lesson.html?id=${encodeURIComponent(i.id)}"><span class="glyph">${String(i.n).padStart(2, '0')}</span><span class="txt"><strong>${esc(i.title)}</strong>${lang === 'zh' && i.zh ? `<small>${esc(i.zh)}</small>` : ''}</span>${open ? `<span class="go">${icon('arrow')}</span>` : lock}</a>`).join('')}
  </div></section>`).join('');
}
async function lessonStatus() { try { lessonSt = await MGAccess.status(); } catch { lessonSt = {}; } return lessonSt; }
function recentCard(list) {
  const tt = t();
  const items = list.slice(0, 4);
  return `<section class="card"><div class="card-head"><h3>${esc(tt.recent)}</h3><a class="link-btn" href="${ACCOUNT}">${esc(tt.allResults)} ›</a></div>
    ${items.length ? `<ul class="recent">${items.map(r => `<li><span><strong>${esc(r.title)}</strong><small>${esc(fmtDate(r.when))} · ${r.correct}/${r.answered}</small></span><span class="score">${esc(r.label)}</span></li>`).join('')}</ul>` : `<p class="hint">${esc(tt.recentEmpty)}</p>`}</section>`;
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
    <div class="days">${days.map((d, i) => `<span class="${i === 6 ? 'today' : ''}"><i class="${active.has(d.toDateString()) ? 'on' : ''}"></i>${esc(i === 6 ? tt.today : tt.days[d.getDay()])}</span>`).join('')}</div>
    ${recent.length ? '' : `<p class="hint">${esc(tt.weekEmpty)}</p>`}</section>`;
}
function foot() { return `<p class="foot">${esc(t().foot)}<br><a href="${UP('legacy.html')}">${esc(t().oldSite)}</a></p>`; }

async function viewHome() {
  const tt = t(), now = new Date();
  const list = await loadHistory(subject), st = lessonSt;
  const lessonsBlock = `<div class="section-head"><h2>${esc(tt.lessons)}</h2><a class="link-btn" href="${href(subject, 'lessons')}">${esc(tt.allLessons)} ›</a></div>${courseRows(st)}`;
  return `<div class="page">
    <div class="greet"><div><p class="date">${tt.date(now)}</p><h1>${esc(tt.greet(now.getHours()))}</h1></div></div>
    ${banner()}
    <div class="top-grid">${hero()}${goalCard(list)}</div>
    <div class="section-head"><h2>${esc(tt.practice)}</h2><a class="link-btn" href="${href(subject, 'practice')}">${esc(tt.allPractice)} ›</a></div>
    ${practiceRows(4)}
    ${subject === 'math' ? '' : `<div class="two">${recentCard(list)}${weekCard(list)}</div>`}
    ${lessonsBlock}
    ${foot()}</div>`;
}
function viewPractice() {
  const tt = t();
  return `<div class="page"><div><h1 class="page-title">${esc(tt.practice)}</h1><p class="page-sub">${esc(tt.practiceSub)}</p></div>${practiceRows()}${foot()}</div>`;
}
async function viewLessons() {
  const tt = t(), st = subject === 'math' ? {} : lessonSt;
  return `<div class="page"><div><h1 class="page-title">${esc(tt.lessons)}</h1><p class="page-sub">${esc(subject === 'math' ? tt.mathLessonsSub : tt.lessonsSub)}</p></div>${subject === 'math' ? '' : unlockBar(st)}${lessonList(st)}${foot()}</div>`;
}
function viewSoon(label) {
  const tt = t();
  return `<div class="page"><h1 class="page-title">${esc(label)}</h1><section class="card empty"><h2>${esc(tt.soonTitle)}</h2><p class="muted">${esc(tt.soonText)}</p><a class="btn btn-navy" href="${href(subject)}">${esc(tt.back)}</a></section>${foot()}</div>`;
}

async function render() {
  if (subject !== 'math') await lessonStatus();
  await window.MGNotify?.refresh(notifyCtx());
  renderChrome();
  if (PAGE !== 'home') return;
  const view = document.getElementById('view');
  const n = t().nav;
  let html;
  if (route === 'practice') html = viewPractice();
  else if (route === 'lessons') html = await viewLessons();
  else if (['plan', 'vocab', 'formulas', 'mistakes'].includes(route)) html = viewSoon(n[route]);
  else { route = 'home'; html = await viewHome(); }
  view.innerHTML = html;
}

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
      <div class="more-grid">${nav.more.map(i => `<a href="${esc(i.href || href(subject, i.id))}" data-close>${icon(i.icon)}<strong>${esc(i.label)}</strong><small>${i.soon ? esc(tt.soon) : '›'}</small></a>`).join('')}</div>
      <div class="list-box"><button data-switch-from-more>${esc(tt.switchTitle)}<span class="muted">${esc(L(C[subject].name))} ›</span></button>
        <button data-lang>语言 · Language<span class="muted">${esc(tt.langName)}</span></button>
        ${MG.user ? `<a href="${ACCOUNT}">${esc(tt.account)}<span class="muted">›</span></a><button data-signout>${esc(tt.signOut)}<span class="muted">${icon('logout')}</span></button>` : `<a href="${ACCOUNT}">${esc(tt.signIn)} / ${esc(tt.signUp)}<span class="muted">›</span></a>`}</div></div>`;
  } else if (id === 'goal') {
    const g = goalStore.get(subject), c = C[subject];
    d.innerHTML = `<form class="panel" method="dialog" id="goal-form"><div class="panel-head"><h2 id="dlg-goal-title">${esc(tt.goalTitle)}</h2><button type="button" class="icon-btn" data-close aria-label="${esc(tt.close)}">${icon('x')}</button></div>
      <label class="field">${esc(tt.goalDate)}<input type="date" name="date" value="${esc(g.date || '')}"></label>
      <label class="field">${esc(tt.goalScore)} (${c.goal.min}–${c.goal.max})<input type="number" name="score" min="${c.goal.min}" max="${c.goal.max}" step="${c.goal.step}" inputmode="numeric" value="${esc(g.score || c.goal.score)}"></label>
      ${MG.user ? '' : `<p class="hint">${esc(tt.guestGoal)}</p>`}
      <div class="acts"><button type="button" class="btn btn-ghost" data-close>${esc(tt.cancel)}</button><button type="submit" class="btn btn-navy">${esc(tt.save)}</button></div></form>`;
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
  const el = e.target.closest('[data-open],[data-close],[data-lang],[data-chip],[data-hide-banner],[data-signout],[data-pick],[data-switch-from-more]');
  if (!el) { if (e.target.tagName === 'DIALOG') e.target.close(); return; }
  if (el.matches('[data-open]')) { e.preventDefault(); openDialog(el.dataset.open); }
  else if (el.matches('[data-switch-from-more]')) { document.getElementById('dlg-more').close(); openDialog('switch'); }
  else if (el.matches('[data-pick]')) {
    e.preventDefault(); subject = el.dataset.pick; pref.set('subject', subject); chip = 0; route = 'home';
    el.closest('dialog').close();
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
  else if (el.matches('[data-hide-banner]')) { pref.set('banner-hidden', true); render(); }
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
document.addEventListener('change', e => {
  if (e.target.id === 'course-select') { goalStore.set('math', { ...goalStore.get('math'), course: e.target.value }); render(); }
});
window.addEventListener('hashchange', () => {
  if (PAGE !== 'home') return; route = location.hash.slice(1) || 'home'; document.querySelectorAll('dialog[open]').forEach(d => d.close()); render(); window.scrollTo(0, 0); });

window.MGShell = { get lang() { return lang; }, get subject() { return subject; }, render, V2, ROOT };

/* ---------- Start ---------- */
pref.set('subject', subject);
renderChrome();
Promise.all([MG.ready, loadCounts()]).then(render, render);
})();
