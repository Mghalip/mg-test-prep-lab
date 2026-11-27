'use strict';
/* Teacher page: weekly codes, student approvals, one-time lesson upload into the private bucket. */
(() => {
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const view = document.getElementById('view');
const SUBJ = [['sat', 'SAT'], ['act', 'ACT'], ['math', '数学']];
const fmt = c => c ? `${c.slice(0, 3)}-${c.slice(3)}` : '—';
const day = d => `${d.getMonth() + 1}月${d.getDate()}日`;
let students = [], filter = '', notices = [], noticesError = '';

function weekRange(weekStart, offset = 0) {
  const s = new Date(weekStart + 'T00:00:00'); s.setDate(s.getDate() + offset);
  const e = new Date(s); e.setDate(e.getDate() + 6);
  return { s, e };
}
async function codesHtml() {
  const { data, error } = await MG.client.rpc('mg_lesson_codes');
  if (error) throw error;
  return `<section class="page" id="codes" style="gap:12px"><div class="section-head"><h2>本周密码</h2><span class="hint">每周一 0:00（北京时间）自动更换</span></div>
    <div class="code-cards">${data.map(r => {
      const name = SUBJ.find(s => s[0] === r.subject)[1], now = weekRange(r.week_start), nx = weekRange(r.week_start, 7);
      const notice = `本周 ${name} 课件密码：${fmt(r.this_week)}（${day(now.s)}–${day(now.e)} 有效）`;
      return `<div class="card code-card"><div class="card-head" style="margin:0"><h3>${esc(name)}</h3>${r.subject === 'math' ? '<span class="tag-soon">暂无课件</span>' : ''}</div>
        <div class="big">${esc(fmt(r.this_week))}</div>
        <p class="hint">${day(now.s)}–${day(now.e)} 有效</p>
        <p class="hint">下周（${day(nx.s)} 起）：<span class="next">${esc(fmt(r.next_week))}</span></p>
        <div class="acts"><button class="btn btn-ghost" data-copy="${esc(notice)}">复制通知</button><button class="btn btn-ghost" data-rotate="${r.subject}">立即换新</button></div></div>`;
    }).join('')}</div>
    <p class="hint">"立即换新"会让这一科本周和下周的密码都换掉，本周已经输过旧密码的游客需要重新输入。已批准的学生不受影响。</p></section>`;
}
function studentsHtml() {
  const q = filter.trim().toLowerCase();
  const list = students.filter(s => !q || (s.display_name + ' ' + s.email).toLowerCase().includes(q));
  return `<section class="page" id="students" style="gap:12px"><div class="section-head"><h2>批准学生</h2><input class="search" id="search" type="search" placeholder="搜索姓名或邮箱" value="${esc(filter)}" aria-label="搜索学生"></div>
    <p class="hint">打开开关后，这个学生登录就能直接看该科课件，不用密码。只列出已注册的账号。</p>
    <div class="table-wrap"><table class="students"><thead><tr><th>姓名</th><th>邮箱</th><th>注册时间</th>${SUBJ.map(s => `<th class="c">${s[1]}</th>`).join('')}</tr></thead><tbody>
    ${list.length ? list.map(s => `<tr><td>${esc(s.display_name)}</td><td>${esc(s.email)}</td><td>${esc(new Date(s.joined).toLocaleDateString('zh-CN'))}</td>${SUBJ.map(([k, n]) => `<td class="c"><button class="toggle" aria-pressed="${!!s[k]}" aria-label="${esc(s.display_name)} · ${n}" data-user="${s.id}" data-subj="${k}"></button></td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="6" class="hint">${students.length ? '没有匹配的学生' : '还没有学生注册'}</td></tr>`}
    </tbody></table></div></section>`;
}
function noticesHtml() {
  const label = { all: '全部学生', sat: 'SAT', act: 'ACT', math: '数学' };
  return `<section class="page" id="notices" style="gap:12px"><div class="section-head"><h2>发布通知</h2></div>
    <form class="card" id="notice-form" style="display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <label class="field" style="flex:0 0 180px">发给<select class="select" name="subject">${Object.entries(label).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
        <label class="field" style="flex:1;min-width:220px">标题<input name="title" maxlength="120" required placeholder="例如：本周六 9:00 SAT 模考"></label></div>
      <label class="field">内容<textarea name="body" maxlength="2000" rows="4" placeholder="具体说明，学生会在通知面板里看到。" style="min-height:96px;padding:10px 12px;border-radius:8px;border:1px solid var(--line);font:inherit"></textarea></label>
      <p class="hint">通知所有人都能看到（包括没登录的游客）。<strong>不要在这里发课件密码。</strong>选了某一科，就只有正在看这一科的学生会看到。</p>
      <div><button class="btn btn-navy" type="submit">发布</button> <span class="hint" id="notice-msg"></span></div></form>
    ${noticesError ? `<p class="hint">${esc(noticesError)}</p>` : notices.length ? `<div class="table-wrap"><table class="students"><thead><tr><th>发布时间</th><th>发给</th><th>标题</th><th></th></tr></thead><tbody>
      ${notices.map(n => `<tr><td>${esc(new Date(n.created_at).toLocaleString('zh-CN'))}</td><td>${esc(label[n.subject] || n.subject)}</td><td style="white-space:normal"><strong>${esc(n.title)}</strong>${n.body ? `<br><span class="hint">${esc(n.body)}</span>` : ''}</td><td><button class="btn btn-ghost" data-del-notice="${n.id}">删除</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="hint">还没有发布过通知。</p>'}
  </section>`;
}
async function loadNotices() {
  const { data, error } = await MG.client.from('mg_notices').select('id,subject,title,body,created_at').order('created_at', { ascending: false }).limit(30);
  if (error) { notices = []; noticesError = '通知功能还没开启：请在 Supabase 里运行 backend/005_notices.sql。'; return; }
  notices = data; noticesError = '';
}
function uploadHtml() {
  const counts = SUBJ.map(([k, n]) => `${n} ${MGLessons.forSubject(k).length} 份`).join(' · ');
  return `<section class="page" id="uploads" style="gap:12px"><div class="section-head"><h2>课件上传</h2></div>
    <div class="card" style="display:flex;flex-direction:column;gap:10px">
      <p class="muted" style="margin:0">把现在网站上公开的课件复制到私有存储（${counts}）。只需要做一次；以后更新某份课件时，也可以再点一次覆盖上传。</p>
      <div class="acts" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-navy" id="upload">开始上传</button><button class="btn btn-ghost" id="check">检查上传情况</button></div>
      <div class="log" id="log" hidden></div></div></section>`;
}
async function loadStudents() {
  const { data, error } = await MG.client.rpc('mg_lesson_students');
  if (error) throw error;
  students = data;
}
async function render() {
  try {
    await Promise.all([loadStudents(), loadNotices()]);
    view.innerHTML = `<div class="page"><header class="staff-heading"><h1>教学管理</h1><nav aria-label="教师工作区"><a href="../account.html?view=teacher">学生成绩与错题反馈 ↗</a><a href="./#board">讨论区管理 ↗</a>${[['codes','本周密码'],['notices','通知'],['students','学生权限'],['uploads','课件上传']].map(([id,label])=>`<a href="#${id}">${label}</a>`).join('')}</nav></header>${await codesHtml()}${noticesHtml()}${studentsHtml()}${uploadHtml()}</div>`;
  } catch (e) {
    view.innerHTML = `<div class="page"><section class="card empty"><h2>无法读取</h2><p class="muted">${esc(e.message)}</p><p class="hint">如果提示找不到函数，请先在 Supabase 里运行 backend/004_lesson_access.sql。</p></section></div>`;
  }
}
function log(line) { const el = document.getElementById('log'); el.hidden = false; el.textContent += line + '\n'; el.scrollTop = el.scrollHeight; }
async function upload(btn) {
  btn.disabled = true;
  const items = MGLessons.items;
  let ok = 0, fail = 0;
  log(`开始上传 ${items.length} 份课件…`);
  for (const [i, it] of items.entries()) {
    try {
      const r = await fetch('../' + it.src, { cache: 'no-store' });
      if (!r.ok) throw Error(`原文件读取失败（${r.status}）`);
      const blob = await r.blob();
      const { error } = await MG.client.storage.from('mg-lessons').upload(it.key, blob, { upsert: true, contentType: 'text/plain;charset=utf-8', cacheControl: '3600' });
      if (error) throw error;
      ok++; log(`✓ ${i + 1}/${items.length} ${it.key}`);
    } catch (e) { fail++; log(`✕ ${i + 1}/${items.length} ${it.key} · ${e.message}`); }
  }
  log(`完成：成功 ${ok} 份，失败 ${fail} 份。${fail ? '可以再点一次"开始上传"重试。' : ''}`);
  btn.disabled = false;
}
async function check(btn) {
  btn.disabled = true;
  let have = 0;
  const missing = [];
  for (const [subject, courses] of Object.entries(MGLessons.COURSES)) {
    for (const c of courses) {
      const { data, error } = await MG.client.storage.from('mg-lessons').list(`${subject}/${c.id}`, { limit: 200 });
      if (error) { log(`✕ ${subject}/${c.id} · ${error.message}`); continue; }
      const names = new Set(data.map(o => o.name));
      for (const it of MGLessons.forCourse(subject, c.id)) { if (names.has(it.key.split('/').pop())) have++; else missing.push(it.key); }
    }
  }
  log(`私有存储里已有 ${have} / ${MGLessons.items.length} 份。${missing.length ? '缺少：\n' + missing.join('\n') : '全部齐了。'}`);
  btn.disabled = false;
}

view.addEventListener('click', async e => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.copy) { try { await navigator.clipboard.writeText(t.dataset.copy); t.textContent = '已复制'; setTimeout(() => t.textContent = '复制通知', 1500); } catch { prompt('复制这段话：', t.dataset.copy); } }
  else if (t.dataset.rotate) {
    if (!confirm('确定要立即更换这一科的密码吗？')) return;
    t.disabled = true;
    const { error } = await MG.client.rpc('mg_lesson_rotate', { p_subject: t.dataset.rotate });
    if (error) { alert('更换失败：' + error.message); t.disabled = false; return; }
    render();
  } else if (t.classList.contains('toggle')) {
    const on = t.getAttribute('aria-pressed') !== 'true';
    t.disabled = true;
    const { error } = await MG.client.rpc('mg_lesson_set_access', { p_user: t.dataset.user, p_subject: t.dataset.subj, p_on: on });
    t.disabled = false;
    if (error) { alert('保存失败：' + error.message); return; }
    t.setAttribute('aria-pressed', String(on));
    const s = students.find(x => x.id === t.dataset.user); if (s) s[t.dataset.subj] = on;
  } else if (t.dataset.delNotice) {
    if (!confirm('删除这条通知？学生那边也会消失。')) return;
    t.disabled = true;
    const { error } = await MG.client.from('mg_notices').delete().eq('id', t.dataset.delNotice);
    if (error) { alert('删除失败：' + error.message); t.disabled = false; return; }
    render();
  } else if (t.id === 'upload') upload(t);
  else if (t.id === 'check') check(t);
});
view.addEventListener('submit', async e => {
  if (e.target.id !== 'notice-form') return;
  e.preventDefault();
  const f = e.target, btn = f.querySelector('button[type=submit]'), m = document.getElementById('notice-msg');
  btn.disabled = true; m.textContent = '正在发布…';
  const { error } = await MG.client.from('mg_notices').insert({ subject: f.subject.value, title: f.title.value.trim(), body: f.body.value.trim() });
  btn.disabled = false;
  if (error) { m.textContent = '发布失败：' + error.message; return; }
  render();
});
view.addEventListener('input', e => {
  if (e.target.id !== 'search') return;
  filter = e.target.value;
  const wrap = e.target.closest('section');
  wrap.outerHTML = studentsHtml();
  const input = document.getElementById('search'); input.focus(); input.setSelectionRange(filter.length, filter.length);
});

MG.ready.then(() => {
  if (!MG.user) { view.innerHTML = `<div class="page"><section class="card empty"><h2>请先登录</h2><p class="muted">用老师账号登录后再打开这一页。</p><a class="btn btn-navy" href="account.html">登录</a></section></div>`; return; }
  if (!MG.teacher) { view.innerHTML = `<div class="page"><section class="card empty"><h2>没有权限</h2><p class="muted">这一页只对老师账号开放。</p><a class="btn btn-ghost" href="./">回到首页</a></section></div>`; return; }
  render();
});
})();
