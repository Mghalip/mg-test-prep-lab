'use strict';
/* Lesson viewer: checks access, then shows the lesson in a sandboxed frame. */
(() => {
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let lang = 'zh';
try { lang = JSON.parse(localStorage.getItem('mg-v2-lang')) === 'en' ? 'en' : 'zh'; } catch {}
const T = {
  zh: {
    back: '课程', of: (a, b) => `第 ${a} / ${b} 讲`, prev: '上一讲', next: '下一讲',
    lockedTitle: '输入本周密码查看课件', lockedText: s => `${s} 课件每周一 0:00 换密码，请向老师要本周的密码。输入一次，本周都能看。`,
    codePh: '例如 7KQ-M4P', open: '查看课件', or: '或者', signedIn: '已登录？',
    approvedText: '注册的学生由老师在后台批准后，不用密码就能看。', signIn: '登录 / 注册', waitApprove: '你已登录。老师批准后，这里不用密码就能打开。',
    wrong: '密码不对，请检查后再试。', wait: '尝试次数太多，请 10 分钟后再试。', okMsg: '已解锁，正在打开…',
    anon: '暂时无法验证密码（访客验证未开启），请联系老师。', net: '网络连接失败，请稍后重试。',
    missing: '这份课件还没有上传，请告诉老师。', loadErr: '课件加载失败，请刷新重试。', notFound: '找不到这份课件。', home: '回到首页',
    cloudOff: '学习账号服务暂时不可用，请稍后再试。'
  },
  en: {
    back: 'Lessons', of: (a, b) => `Lesson ${a} of ${b}`, prev: 'Previous', next: 'Next',
    lockedTitle: 'Enter this week’s code', lockedText: s => `${s} lessons use a code that changes every Monday at 00:00 (Beijing time). Ask your teacher for this week’s code. Enter it once and it works all week.`,
    codePh: 'e.g. 7KQ-M4P', open: 'Open lesson', or: 'or', signedIn: 'Have an account?',
    approvedText: 'Registered students your teacher approves can open lessons without a code.', signIn: 'Sign in / Sign up', waitApprove: 'You’re signed in. Once your teacher approves you, lessons open without a code.',
    wrong: 'That code isn’t right. Check it and try again.', wait: 'Too many tries. Please wait 10 minutes.', okMsg: 'Unlocked. Opening…',
    anon: 'Codes can’t be checked right now (guest access is off). Please contact your teacher.', net: 'Connection failed. Please try again.',
    missing: 'This lesson hasn’t been uploaded yet. Please tell your teacher.', loadErr: 'The lesson didn’t load. Please refresh.', notFound: 'Lesson not found.', home: 'Back to Home',
    cloudOff: 'The account service is unavailable right now. Please try again later.'
  }
}[lang];
const ICON = {
  back: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>',
  prev: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
  next: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
  lock: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true" style="width:24px;height:24px"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'
};

const id = new URLSearchParams(location.search).get('id');
const item = MGLessons.byId(id);
const stage = document.getElementById('stage');
const bar = document.getElementById('vbar');
const langQ = lang === 'en' ? '&lang=en' : '';

if (!item) {
  bar.innerHTML = `<a class="back" href="./">${ICON.back}MG</a>`;
  stage.innerHTML = `<div class="gate-wrap"><div class="gate"><h1>${esc(T.notFound)}</h1><a class="btn btn-navy" href="./">${esc(T.home)}</a></div></div>`;
  return;
}
document.body.dataset.subject = item.subject;
document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
const course = MGLessons.COURSES[item.subject].find(c => c.id === item.course);
const siblings = MGLessons.forCourse(item.subject, item.course);
const pos = siblings.indexOf(item);
const link = it => it ? `lesson.html?id=${encodeURIComponent(it.id)}` : '#';
document.title = `${item.title} · ${course[lang]} · MG Test Prep Lab`;
bar.innerHTML = `<a class="back" href="./?s=${item.subject}${langQ}#lessons">${ICON.back}<span>${esc(T.back)}</span></a>
  <div class="title"><strong>${esc(item.title)}</strong><small>${esc(course[lang])} · ${esc(T.of(pos + 1, siblings.length))}${lang === 'zh' && item.zh ? ' · ' + esc(item.zh) : ''}</small></div>
  <nav class="nav"><a class="icon-btn" href="${link(siblings[pos - 1])}" aria-label="${esc(T.prev)}"${pos === 0 ? ' aria-disabled="true"' : ''}>${ICON.prev}</a>
  <a class="icon-btn" href="${link(siblings[pos + 1])}" aria-label="${esc(T.next)}"${pos === siblings.length - 1 ? ' aria-disabled="true"' : ''}>${ICON.next}</a></nav>`;

async function show() {
  stage.innerHTML = '<p class="loading">…</p>';
  try {
    const html = await MGAccess.load(item);
    const f = document.createElement('iframe');
    f.title = item.title;
    // No allow-same-origin: the lesson runs in an isolated origin and cannot read this site's sign-in.
    f.setAttribute('sandbox', 'allow-scripts allow-popups allow-modals allow-downloads');
    f.setAttribute('allow', 'fullscreen');
    f.srcdoc = html;
    f.addEventListener('load', () => { try { f.focus(); } catch {} });
    stage.replaceChildren(f);
  } catch (e) {
    const msg = e.code === 'missing' ? T.missing : e.code === 'locked' ? null : T.loadErr;
    if (!msg) return gate();
    stage.innerHTML = `<div class="gate-wrap"><div class="gate"><p class="msg err">${esc(msg)}</p></div></div>`;
  }
}
function gate(signedIn = !!MG.user) {
  const subj = item.subject.toUpperCase();
  stage.innerHTML = `<div class="gate-wrap"><div class="gate">
    <span class="lock">${ICON.lock}</span>
    <h1>${esc(T.lockedTitle)}</h1>
    <p class="muted">${esc(T.lockedText(subj))}</p>
    <form class="code-form" id="code-form" autocomplete="off">
      <label class="sr-only" for="code">${esc(T.lockedTitle)}</label>
      <input id="code" name="code" inputmode="text" autocapitalize="characters" spellcheck="false" maxlength="9" placeholder="${esc(T.codePh)}" required>
      <button class="btn btn-navy" type="submit">${esc(T.open)}</button>
    </form>
    <p class="msg" id="msg" role="status" aria-live="polite"></p>
    <div class="or">${esc(T.or)}</div>
    ${signedIn ? `<p class="muted">${esc(T.waitApprove)}</p>` : `<p class="muted">${esc(T.approvedText)}</p><div><a class="btn btn-ghost" href="account.html">${esc(T.signIn)}</a></div>`}
  </div></div>`;
  const form = document.getElementById('code-form'), msg = document.getElementById('msg');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true; msg.className = 'msg'; msg.textContent = '';
    try {
      const r = await MGAccess.unlock(item.subject, form.code.value);
      if (r === 'ok') {
        try { const u = JSON.parse(localStorage.getItem('mg-v2-unlocked-subjects')) || []; if (!u.includes(item.subject)) { u.push(item.subject); localStorage.setItem('mg-v2-unlocked-subjects', JSON.stringify(u)); localStorage.setItem('mg-v2-first-unlock-' + item.subject, String(Date.now())); } } catch {}
        msg.className = 'msg ok'; msg.textContent = T.okMsg; await show(); return;
      }
      msg.className = 'msg err'; msg.textContent = r === 'wait' ? T.wait : T.wrong;
    } catch (err) {
      msg.className = 'msg err'; msg.textContent = err.code === 'anon' ? T.anon : T.net;
    }
    btn.disabled = false; form.code.select();
  });
  document.getElementById('code').focus();
}

(async () => {
  await MG.ready;
  if (!MG.client && !window.READING_CONFIG?.enabled) { stage.innerHTML = `<div class="gate-wrap"><div class="gate"><p class="msg err">${esc(T.cloudOff)}</p></div></div>`; return; }
  try {
    const st = await MGAccess.status();
    if (st[item.subject]?.can_view) return show();
  } catch {}
  gate();
})();
})();
