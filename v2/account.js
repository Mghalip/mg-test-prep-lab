'use strict';
/* v2 account page. Signed out: bilingual sign-in / sign-up. Signed in: the existing results workspace
   (account.js + reflection.js from the site root), restyled by v2/account.css. */
(() => {
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const main = document.getElementById('view'), el = document.getElementById('account-content');
const ROOT = window.MGShell?.ROOT || new URL('../', document.baseURI).href;
const T = {
  zh: {
    kicker: 'MY ACCOUNT', title: '学习账号', mine: '我的学习空间', mineK: 'MY LEARNING',
    intro: 'SAT、ACT 和数学共用一个账号。注册后请先去邮箱点验证链接。',
    signIn: '登录', email: '邮箱', password: '密码', forgot: '忘记密码', signUpT: '创建免费账号', name: '姓名 / 学习昵称',
    namePh: '老师会看到这个名字', pw10: '密码（至少 10 位）', signUpBtn: '注册并发送验证邮件',
    have: '账号能保存什么', rows: [['做题、模考、对答案', true], ['成绩同步到云端，换设备也能看', false], ['错题分析，老师可以看到并给反馈', false], ['老师批准后，课件不用每周输密码', false]],
    guest: '游客', acct: '账号', guestNote: '以前用游客身份做的记录，不会自动转进新账号。',
    busy: '正在处理…', failIn: '登录失败：请检查邮箱、密码，以及邮箱是否已经验证。', needName: '请输入姓名或学习昵称。',
    sentUp: '验证邮件已发出。点邮件里的链接完成验证后，回到这里登录。如果这个邮箱已经注册过，请直接登录或重置密码。',
    sentReset: '如果这个邮箱已注册，你会收到重置密码的邮件，按邮件里的链接设置新密码。', emailFirst: '请先在上面填写邮箱。',
    resetT: '设置新密码', newPw: '新密码（至少 10 位）', again: '再输入一次', save: '保存新密码', mismatch: '两次输入的密码不一样。',
    cloudT: '学习账号暂时连不上', cloudB: '模考和练习照常能用，记录先保存在这台设备上。', retry: '重新连接', generic: '请求失败，请稍后再试。'
  },
  en: {
    kicker: 'MY ACCOUNT', title: 'Your account', mine: 'My learning', mineK: 'MY LEARNING',
    intro: 'One account for SAT, ACT and Math. After signing up, confirm your email from the link we send.',
    signIn: 'Sign in', email: 'Email', password: 'Password', forgot: 'Forgot password', signUpT: 'Create a free account', name: 'Name or nickname',
    namePh: 'Your teacher will see this name', pw10: 'Password (at least 10 characters)', signUpBtn: 'Sign up and send confirmation email',
    have: 'What an account keeps', rows: [['Practice, mocks and answer checking', true], ['Results synced to the cloud, on any device', false], ['Mistake analysis your teacher can read and reply to', false], ['Once approved, lessons open without weekly codes', false]],
    guest: 'Guest', acct: 'Account', guestNote: 'Work you did as a guest isn’t moved into a new account automatically.',
    busy: 'Working…', failIn: 'Sign-in failed. Check your email, password, and that your email is confirmed.', needName: 'Please enter a name or nickname.',
    sentUp: 'Confirmation email sent. Click the link in it, then come back here to sign in. If this email is already registered, sign in or reset your password.',
    sentReset: 'If this email is registered, you’ll get a link to set a new password.', emailFirst: 'Enter your email above first.',
    resetT: 'Set a new password', newPw: 'New password (at least 10 characters)', again: 'Enter it again', save: 'Save new password', mismatch: 'The two passwords don’t match.',
    cloudT: 'Can’t reach your account right now', cloudB: 'Mocks and practice still work; results are kept on this device for now.', retry: 'Try again', generic: 'Something went wrong. Please try again.'
  }
};
const lang = () => (window.MGShell?.lang === 'en' ? 'en' : 'zh');
const t = () => T[lang()];
function heading(k, h) { main.querySelector('.kicker').textContent = k; main.querySelector('h1').textContent = h; document.title = `MG Test Prep Lab · ${h}`; }
function msg(text, ok) { const m = document.getElementById('acct-msg'); if (m) { m.className = 'msg' + (ok ? ' ok' : text ? ' err' : ''); m.textContent = text; } }
async function act(form, task) {
  const btns = [...form.querySelectorAll('button')]; btns.forEach(b => b.disabled = true); msg(t().busy);
  try { await task(); } catch (e) { msg(e.message || t().generic); } finally { btns.forEach(b => b.disabled = false); }
}

function authForms() {
  const tt = t();
  heading(tt.kicker, tt.title);
  el.innerHTML = `<p class="muted acct-intro">${esc(tt.intro)}</p>
  <p id="acct-msg" class="msg" role="status" aria-live="polite"></p>
  <div class="acct-grid">
    <form class="card acct-form" id="signin" autocomplete="on"><h2>${esc(tt.signIn)}</h2>
      <label class="field">${esc(tt.email)}<input name="email" type="email" autocomplete="username" required></label>
      <label class="field">${esc(tt.password)}<input name="password" type="password" autocomplete="current-password" required></label>
      <div class="acct-actions"><button class="btn btn-navy" type="submit">${esc(tt.signIn)}</button><button class="link-btn" type="button" id="forgot">${esc(tt.forgot)}</button></div></form>
    <form class="card acct-form" id="signup"><h2>${esc(tt.signUpT)}</h2>
      <label class="field">${esc(tt.name)}<input name="display_name" maxlength="80" autocomplete="name" placeholder="${esc(tt.namePh)}" required></label>
      <label class="field">${esc(tt.email)}<input name="email" type="email" autocomplete="email" required></label>
      <label class="field">${esc(tt.pw10)}<input name="password" type="password" minlength="10" autocomplete="new-password" required></label>
      <button class="btn btn-accent" type="submit">${esc(tt.signUpBtn)}</button></form>
    <section class="card acct-compare"><h2>${esc(tt.have)}</h2>
      <div class="cmp-head"><span></span><span>${esc(tt.guest)}</span><span>${esc(tt.acct)}</span></div>
      ${tt.rows.map(([l, g]) => `<div class="cmp-row"><span>${esc(l)}</span><span class="${g ? 'yes' : 'no'}">${g ? '✓' : '—'}</span><span class="yes">✓</span></div>`).join('')}
      <p class="hint">${esc(tt.guestNote)}</p></section>
  </div>`;
  document.getElementById('signin').onsubmit = e => { e.preventDefault(); const f = e.target; act(f, async () => {
    const { error } = await MG.client.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
    if (error) throw Error(t().failIn);
    location.reload();
  }); };
  document.getElementById('signup').onsubmit = e => { e.preventDefault(); const f = e.target; act(f, async () => {
    const name = f.display_name.value.trim(); if (!name) throw Error(t().needName);
    const { error } = await MG.client.auth.signUp({ email: f.email.value.trim(), password: f.password.value, options: { emailRedirectTo: ROOT + 'account.html', data: { display_name: name } } });
    if (error) throw error;
    f.password.value = ''; msg(t().sentUp, true);
  }); };
  document.getElementById('forgot').onclick = () => { const f = document.getElementById('signin'); if (!f.email.value.trim()) { msg(t().emailFirst); f.email.focus(); return; } act(f, async () => {
    const { error } = await MG.client.auth.resetPasswordForEmail(f.email.value.trim(), { redirectTo: ROOT + 'account.html' });
    if (error) throw error;
    msg(t().sentReset, true);
  }); };
}
function resetForm() {
  const tt = t();
  heading(tt.kicker, tt.resetT);
  el.innerHTML = `<form class="card acct-form" id="reset" style="max-width:460px"><h2>${esc(tt.resetT)}</h2>
    <label class="field">${esc(tt.newPw)}<input name="password" type="password" minlength="10" autocomplete="new-password" required></label>
    <label class="field">${esc(tt.again)}<input name="confirm" type="password" minlength="10" autocomplete="new-password" required></label>
    <p id="acct-msg" class="msg" role="status"></p><button class="btn btn-navy" type="submit">${esc(tt.save)}</button></form>`;
  document.getElementById('reset').onsubmit = e => { e.preventDefault(); const f = e.target; if (f.password.value !== f.confirm.value) return msg(t().mismatch); act(f, async () => {
    const { error } = await MG.client.auth.updateUser({ password: f.password.value }); if (error) throw error; location.replace(location.pathname);
  }); };
}
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.body.append(s); }); }

let mode = '';
MG.ready.then(async () => {
  if (!MG.available) { const tt = t(); el.innerHTML = `<section class="card"><h2>${esc(tt.cloudT)}</h2><p class="muted">${esc(MG.error || '')}</p><p>${esc(tt.cloudB)}</p><button class="btn btn-ghost" onclick="location.reload()">${esc(tt.retry)}</button></section>`; return; }
  if (MG.recovery && MG.user) { mode = 'reset'; return resetForm(); }
  if (!MG.user) { mode = 'auth'; return authForms(); }
  mode = 'dash';
  heading(t().mineK, t().mine);
  main.classList.add('acct-dash');
  // Existing workspace: results, filters, review queue, reflections (Chinese-only for now).
  await loadScript(ROOT + 'reflection.js?v=20261114-scanned-forms2');
  await loadScript(ROOT + 'account.js?v=20261027-selected');
});
// Links inside the existing workspace point at the old account page; keep students on this one.
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="account.html"]');
  if (!a) return;
  e.preventDefault();
  location.href = (window.MGShell?.V2 || '') + a.getAttribute('href');
}, true);
document.addEventListener('mg-lang', () => { if (mode === 'auth') authForms(); else if (mode === 'reset') resetForm(); });
})();
