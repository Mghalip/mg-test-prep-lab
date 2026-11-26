'use strict';
/* v2 account page. Signed out: bilingual sign-in / sign-up. Signed in: the existing results workspace
   (account.js + reflection.js from the site root), restyled by v2/account.css. */
(() => {
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const main = document.getElementById('view'), el = document.getElementById('account-content');
const ROOT = window.MGShell?.ROOT || new URL('../', document.baseURI).href;
const T = {
  zh: {
    kicker: 'ACCOUNT', title: '学习账号', mine: '我的成绩与记录', mineK: 'MY LEARNING',
    intro: 'SAT、ACT 和数学共用一个账号。注册后请打开验证邮件完成激活。',
    signIn: '登录', email: '邮箱', password: '密码', forgot: '忘记密码', signUpT: '注册账号', name: '姓名 / 昵称',
    namePh: '老师后台显示的名字', pw10: '密码（至少 10 位）', signUpBtn: '注册并发送验证邮件',
    have: '账号说明', rows: [['做题、模考、核对答案', true], ['成绩同步到云端，跨设备查看', false], ['提交错题分析并接收老师反馈', false], ['老师批准后免每周密码看课件', false]],
    guest: '未登录', acct: '已登录', guestNote: '未登录时做的记录保存在当前浏览器，不会自动并入新注册的账号。',
    busy: '正在处理…', failIn: '登录失败：请核对邮箱、密码及邮件验证状态。', needName: '请填写姓名或昵称。',
    sentUp: '验证邮件已发送，点击邮件内链接激活后再回来登录。若该邮箱已注册，请直接登录或重置密码。',
    sentReset: '若该邮箱已注册，重置密码的链接将发送至你的邮箱。', emailFirst: '请先填写邮箱地址。',
    resetT: '设置新密码', newPw: '新密码（至少 10 位）', again: '确认密码', save: '保存新密码', mismatch: '两次输入的密码不一致。',
    cloudT: '暂时无法连接账号服务', cloudB: '模考和练习仍可正常使用，记录暂存当前设备。', retry: '重试', generic: '操作失败，请稍后重试。'
  },
  en: {
    kicker: 'ACCOUNT', title: 'Account', mine: 'My results', mineK: 'MY LEARNING',
    intro: 'One account covers SAT, ACT, and Math. Confirm your email after signing up.',
    signIn: 'Sign in', email: 'Email', password: 'Password', forgot: 'Forgot password', signUpT: 'Create account', name: 'Name or nickname',
    namePh: 'Shown to your teacher', pw10: 'Password (10+ characters)', signUpBtn: 'Sign up and send email',
    have: 'Guest vs. account', rows: [['Practice, mocks, and answer review', true], ['Cloud sync across devices', false], ['Submit mistake notes for teacher feedback', false], ['Approved access to lessons without weekly codes', false]],
    guest: 'Guest', acct: 'Account', guestNote: 'Local guest records are not merged into new accounts automatically.',
    busy: 'Working…', failIn: 'Sign-in failed. Check your email, password, and verification status.', needName: 'Please enter a name or nickname.',
    sentUp: 'Verification email sent. Open the link inside, then sign in here.',
    sentReset: 'If this email is registered, a password reset link will arrive shortly.', emailFirst: 'Enter your email first.',
    resetT: 'Set new password', newPw: 'New password (10+ characters)', again: 'Confirm password', save: 'Save password', mismatch: 'Passwords do not match.',
    cloudT: 'Account service unavailable', cloudB: 'Mocks and practice still work locally on this device.', retry: 'Retry', generic: 'Request failed. Please try again.'
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
      <button class="btn btn-ghost" type="submit">${esc(tt.signUpBtn)}</button></form>
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
