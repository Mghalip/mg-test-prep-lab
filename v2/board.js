'use strict';
/* Discussion board (讨论区) module for MG Test Prep Lab v2 shell. */
window.MGBoard = (() => {
const PAGE_SIZE = 20;
const MAX_BODY = 2000;
const MAX_TITLE = 120;
const DRAFT_KEY = 'mg-v2-board-draft';
const REPLY_DRAFT_KEY = 'mg-v2-board-reply-drafts';
const FILTERS = ['all', 'sat', 'act', 'math'];
const DAY = 864e5;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const T = {
  zh: {
    title: '讨论区',
    sub: '在这里提问、分享备考经验或向老师咨询。所有同学均可浏览，登录后可发帖和回复。',
    filters: { all: '全部', sat: 'SAT', act: 'ACT', math: '数学' },
    postSubj: { all: '综合', sat: 'SAT', act: 'ACT', math: '数学' },
    refresh: '刷新',
    loading: '正在加载讨论…',
    countN: n => `已加载 ${n} 条`,
    guestTitle: '登录后即可发帖或回复讨论',
    guestDesc: '请先登录或注册学习账号，发帖时将显示你的昵称。',
    signIn: '去登录 / 注册',
    subjLabel: '板块',
    titlePh: '标题（可选，最多 120 字）',
    bodyPh: '写下你的问题、解题疑惑或备考心得…',
    pinOnPost: '发帖并置顶',
    submitPost: '发布讨论',
    submitting: '发布中…',
    posted: '已发布。',
    needBody: '请输入内容后再发布。',
    tooLong: '内容不能超过 2000 字。',
    rateLimit: '发帖太频繁，请几秒后再试。',
    teacher: '老师',
    pinned: '置顶',
    reply: '回复',
    repliesN: n => n ? `回复 (${n})` : '回复',
    pin: '置顶',
    unpin: '取消置顶',
    del: '删除',
    delPostConfirm: '确定要删除这条讨论吗？相关回复也会一并删除。',
    delReplyConfirm: '确定要删除这条回复吗？',
    replyPh: '写下你的回复…',
    replySubmit: '发送回复',
    cancel: '取消',
    loadMore: '加载更多',
    emptyTitle: '还没有讨论',
    emptyDesc: '欢迎发出第一条提问或备考分享。',
    setupTitle: '讨论区正在准备中',
    setupStudent: '评论板数据库尚未启用，请稍后再来查看。',
    setupTeacher: '评论板数据表尚未创建：请在 Supabase SQL Editor 中运行 backend/006_board.sql。',
    offlineTitle: '暂时无法连接讨论区',
    offlineDesc: '请检查网络连接后点击刷新重试。',
    justNow: '刚刚',
    ago: ms => ms < 36e5 ? `${Math.max(1, Math.round(ms / 6e4))} 分钟前` : ms < DAY ? `${Math.round(ms / 36e5)} 小时前` : `${Math.round(ms / DAY)} 天前`,
    errGeneric: '操作失败，请稍后重试。'
  },
  en: {
    title: 'Discussion Board',
    sub: 'Ask questions, share study notes, or reach out to your teacher. Everyone can read; sign in to post and reply.',
    filters: { all: 'All', sat: 'SAT', act: 'ACT', math: 'Math' },
    postSubj: { all: 'General', sat: 'SAT', act: 'ACT', math: 'Math' },
    refresh: 'Refresh',
    loading: 'Loading discussions…',
    countN: n => `${n} loaded`,
    guestTitle: 'Sign in to post or reply',
    guestDesc: 'Use your registered account to start a thread or reply to existing discussions.',
    signIn: 'Sign in / Sign up',
    subjLabel: 'Topic',
    titlePh: 'Title (optional, up to 120 chars)',
    bodyPh: 'Write your question, study note, or feedback…',
    pinOnPost: 'Pin post',
    submitPost: 'Post',
    submitting: 'Posting…',
    posted: 'Posted.',
    needBody: 'Please enter some text before posting.',
    tooLong: 'Message cannot exceed 2000 characters.',
    rateLimit: 'You are posting too quickly. Please wait a few seconds.',
    teacher: 'Teacher',
    pinned: 'Pinned',
    reply: 'Reply',
    repliesN: n => n ? `Replies (${n})` : 'Reply',
    pin: 'Pin',
    unpin: 'Unpin',
    del: 'Delete',
    delPostConfirm: 'Delete this post and all of its replies?',
    delReplyConfirm: 'Delete this reply?',
    replyPh: 'Write a reply…',
    replySubmit: 'Reply',
    cancel: 'Cancel',
    loadMore: 'Load more',
    emptyTitle: 'No discussions yet',
    emptyDesc: 'Be the first to ask a question or share a tip.',
    setupTitle: 'Discussion board is getting ready',
    setupStudent: 'The board backend is not enabled yet. Please check back later.',
    setupTeacher: 'Table mg_comments is not installed yet: run backend/006_board.sql in the Supabase SQL Editor.',
    offlineTitle: 'Unable to reach the discussion board',
    offlineDesc: 'Check your connection and click Refresh to try again.',
    justNow: 'just now',
    ago: ms => ms < 36e5 ? `${Math.max(1, Math.round(ms / 6e4))} min ago` : ms < DAY ? `${Math.round(ms / 36e5)} h ago` : `${Math.round(ms / DAY)} d ago`,
    errGeneric: 'Action failed. Please try again.'
  }
};

let filter = null;
let posts = [];
let repliesByParent = new Map();
let hasMore = false;
let loading = false;
let loadedOnce = false;
let loadedFilter = null;
let loadedAuthKey = null;
let errorKind = '';
let errorMsg = '';
let openReplyId = '';
let composerMsg = { text: '', kind: '' };
let replyMsg = { id: '', text: '', kind: '' };
let lastCtx = null;
let activeView = null;
let loadSeq = 0;

function readDraft() {
  try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY)) || {}; } catch { return {}; }
}
function writeDraft(d) {
  try {
    if (!d || (!d.title && !d.body)) sessionStorage.removeItem(DRAFT_KEY);
    else sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {}
}
function readReplyDrafts() {
  try { return JSON.parse(sessionStorage.getItem(REPLY_DRAFT_KEY)) || {}; } catch { return {}; }
}
function writeReplyDraft(id, text) {
  try {
    const all = readReplyDrafts();
    if (!text) delete all[id];
    else all[id] = text;
    if (Object.keys(all).length) sessionStorage.setItem(REPLY_DRAFT_KEY, JSON.stringify(all));
    else sessionStorage.removeItem(REPLY_DRAFT_KEY);
  } catch {}
}

function activeFilter(ctx) {
  if (filter && FILTERS.includes(filter)) return filter;
  return FILTERS.includes(ctx?.subject) ? ctx.subject : 'all';
}

function setSubject(s) {
  if (FILTERS.includes(s)) {
    filter = s;
    loadedFilter = null;
  }
}

function fmtTime(iso, t, lang) {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '';
  const diff = Date.now() - ts;
  if (diff < 6e4) return t.justNow;
  if (diff < 7 * DAY) return t.ago(diff);
  return new Date(ts).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });
}

function isMissingTableError(err) {
  const code = err?.code || '';
  const msg = err?.message || '';
  return code === '42P01' || code === 'PGRST205' || /mg_comments|schema cache|does not exist/i.test(msg);
}

function mapError(err, t) {
  const m = err?.message || '';
  if (/RATE_LIMIT/i.test(m)) return t.rateLimit;
  if (/AUTH_REQUIRED/i.test(m)) return t.guestTitle;
  if (/EMPTY_BODY/i.test(m)) return t.needBody;
  return m || t.errGeneric;
}

function authSignature() {
  return `${window.MG?.user?.id || ''}:${window.MG?.teacher ? '1' : '0'}:${window.MG?.available ? '1' : '0'}`;
}

function composerHtml(ctx) {
  const lang = ctx.lang === 'en' ? 'en' : 'zh';
  const t = T[lang];
  if (!window.MG?.user) {
    return `<section class="card bd-guest">
      <div class="bd-guest-txt"><strong>${esc(t.guestTitle)}</strong><small>${esc(t.guestDesc)}</small></div>
      <a class="btn btn-primary" href="${esc(ctx.accountHref || 'v2/account.html')}">${esc(t.signIn)}</a>
    </section>`;
  }
  const draft = readDraft();
  const defSubj = FILTERS.includes(draft.subject) ? draft.subject : (FILTERS.includes(filter) && filter !== 'all' ? filter : (FILTERS.includes(ctx.subject) ? ctx.subject : 'all'));
  const bodyVal = draft.body || '';
  const titleVal = draft.title || '';
  const msgCls = composerMsg.kind ? ` ${composerMsg.kind}` : '';
  return `<form class="card bd-composer" id="bd-composer-form">
    <div class="bd-composer-row">
      <select class="select" name="subject" aria-label="${esc(t.subjLabel)}">
        ${FILTERS.map(k => `<option value="${k}"${k === defSubj ? ' selected' : ''}>${esc(t.postSubj[k])}</option>`).join('')}
      </select>
      <input class="bd-input" type="text" name="title" maxlength="${MAX_TITLE}" placeholder="${esc(t.titlePh)}" value="${esc(titleVal)}">
    </div>
    <textarea class="bd-textarea" name="body" maxlength="${MAX_BODY}" rows="3" placeholder="${esc(t.bodyPh)}" required>${esc(bodyVal)}</textarea>
    <div class="bd-composer-foot">
      <div class="bd-composer-meta">
        <span class="bd-char" id="bd-char-count">${bodyVal.length} / ${MAX_BODY}</span>
        ${MG.teacher ? `<label class="bd-pin-opt"><input type="checkbox" name="pinned"${draft.pinned ? ' checked' : ''}><span>${esc(t.pinOnPost)}</span></label>` : ''}
        ${composerMsg.text ? `<p class="bd-msg${msgCls}" role="status" aria-live="polite">${esc(composerMsg.text)}</p>` : '<p class="bd-msg" id="bd-composer-msg" role="status" aria-live="polite"></p>'}
      </div>
      <div class="bd-composer-acts">
        <button class="btn btn-primary" type="submit">${esc(t.submitPost)}</button>
      </div>
    </div>
  </form>`;
}

function canDelete(row) {
  return !!(window.MG?.teacher || (window.MG?.user?.id && row.user_id === window.MG.user.id));
}

function replyHtml(r, t, lang) {
  const initial = (r.author_name || 'M').slice(0, 1).toUpperCase();
  const time = fmtTime(r.created_at, t, lang);
  return `<div class="bd-reply" data-reply-id="${esc(r.id)}">
    <div class="bd-reply-head">
      <div class="bd-reply-meta">
        <span class="bd-avatar${r.is_teacher ? ' is-teacher' : ''}" aria-hidden="true">${esc(initial)}</span>
        <span class="bd-name">${esc(r.author_name)}</span>
        ${r.is_teacher ? `<span class="bd-badge-teacher">${esc(t.teacher)}</span>` : ''}
        <span class="bd-time">${esc(time)}</span>
      </div>
      <div class="bd-reply-acts">
        ${canDelete(r) ? `<button type="button" class="bd-reply-del" data-bd-del="${esc(r.id)}" data-bd-kind="reply">${esc(t.del)}</button>` : ''}
      </div>
    </div>
    <p class="bd-body">${esc(r.body)}</p>
  </div>`;
}

function postHtml(p, t, lang) {
  const replies = repliesByParent.get(p.id) || [];
  const initial = (p.author_name || 'M').slice(0, 1).toUpperCase();
  const time = fmtTime(p.created_at, t, lang);
  const isReplyOpen = openReplyId === p.id && !!window.MG?.user;
  const rDrafts = readReplyDrafts();
  const rText = rDrafts[p.id] || '';
  const rMsg = replyMsg.id === p.id ? replyMsg : { text: '', kind: '' };

  return `<article class="card bd-post${p.pinned ? ' is-pinned' : ''}" data-post-id="${esc(p.id)}">
    <div class="bd-head">
      <div class="bd-author">
        <span class="bd-avatar${p.is_teacher ? ' is-teacher' : ''}" aria-hidden="true">${esc(initial)}</span>
        <span class="bd-name">${esc(p.author_name)}</span>
        ${p.is_teacher ? `<span class="bd-badge-teacher">${esc(t.teacher)}</span>` : ''}
        <span class="bd-badge-subj">${esc(t.postSubj[p.subject] || p.subject)}</span>
        ${p.pinned ? `<span class="bd-pin-badge">${esc(t.pinned)}</span>` : ''}
      </div>
      <span class="bd-time">${esc(time)}</span>
    </div>
    ${p.title ? `<h3 class="bd-title">${esc(p.title)}</h3>` : ''}
    <p class="bd-body">${esc(p.body)}</p>
    <div class="bd-actions">
      ${window.MG?.user ? `<button type="button" class="bd-act-btn" data-bd-reply-toggle="${esc(p.id)}">${esc(t.repliesN(replies.length))}</button>` : (replies.length ? `<span class="bd-count">${esc(t.repliesN(replies.length))}</span>` : '')}
      ${window.MG?.teacher ? `<button type="button" class="bd-act-btn" data-bd-pin="${esc(p.id)}" data-bd-pinned="${p.pinned ? '1' : '0'}">${esc(p.pinned ? t.unpin : t.pin)}</button>` : ''}
      ${canDelete(p) ? `<button type="button" class="bd-act-btn is-danger" data-bd-del="${esc(p.id)}" data-bd-kind="post">${esc(t.del)}</button>` : ''}
    </div>
    ${(replies.length || isReplyOpen) ? `<div class="bd-replies">
      ${replies.map(r => replyHtml(r, t, lang)).join('')}
      ${isReplyOpen ? `<form class="bd-reply-form" data-bd-reply-form="${esc(p.id)}">
        <textarea class="bd-textarea" name="body" maxlength="${MAX_BODY}" rows="2" placeholder="${esc(t.replyPh)}" required>${esc(rText)}</textarea>
        <div class="bd-reply-form-foot">
          ${rMsg.text ? `<p class="bd-msg ${esc(rMsg.kind)}" role="status">${esc(rMsg.text)}</p>` : '<span></span>'}
          <div class="bd-reply-form-btns">
            <button type="button" class="btn btn-ghost btn-sm" data-bd-reply-cancel>${esc(t.cancel)}</button>
            <button type="submit" class="btn btn-primary btn-sm">${esc(t.replySubmit)}</button>
          </div>
        </div>
      </form>` : ''}
    </div>` : ''}
  </article>`;
}

function feedHtml(ctx) {
  const lang = ctx.lang === 'en' ? 'en' : 'zh';
  const t = T[lang];
  if (loading && !posts.length) {
    return `<section class="card bd-empty"><p class="muted">${esc(t.loading)}</p></section>`;
  }
  if (errorKind === 'setup') {
    return `<section class="card bd-empty"><h3>${esc(t.setupTitle)}</h3><p>${esc(window.MG?.teacher ? t.setupTeacher : t.setupStudent)}</p></section>`;
  }
  if (errorKind === 'offline') {
    return `<section class="card bd-empty"><h3>${esc(t.offlineTitle)}</h3><p>${esc(t.offlineDesc)}</p></section>`;
  }
  if (errorKind === 'error') {
    return `<section class="card bd-empty"><h3>${esc(t.errGeneric)}</h3><p>${esc(errorMsg)}</p></section>`;
  }
  if (!posts.length) {
    return `<section class="card bd-empty"><h3>${esc(t.emptyTitle)}</h3><p>${esc(t.emptyDesc)}</p></section>`;
  }
  return `<div class="bd-list">${posts.map(p => postHtml(p, t, lang)).join('')}</div>
    ${hasMore ? `<div class="bd-more"><button type="button" class="btn btn-ghost" data-bd-more${loading ? ' disabled' : ''}>${esc(loading ? t.loading : t.loadMore)}</button></div>` : ''}`;
}

function renderHtml(ctx) {
  lastCtx = ctx;
  const lang = ctx.lang === 'en' ? 'en' : 'zh';
  const t = T[lang];
  const cur = activeFilter(ctx);
  filter = cur;
  return `<div class="page bd-page">
    <header class="page-head">
      <div>
        <h1>${esc(t.title)}</h1>
        <p class="meta">${esc(t.sub)}</p>
      </div>
    </header>
    <div class="bd-toolbar">
      <div class="mode-tabs" role="tablist" aria-label="${esc(t.subjLabel)}">
        ${FILTERS.map(k => `<button type="button" class="chip" role="tab" aria-selected="${k === cur}" data-bd-filter="${k}">${esc(t.filters[k])}</button>`).join('')}
      </div>
      <div class="bd-toolbar-right">
        <span class="bd-count" id="bd-count">${posts.length ? esc(t.countN(posts.length)) : ''}</span>
        <button type="button" class="btn btn-ghost btn-sm" data-bd-refresh>${esc(t.refresh)}</button>
      </div>
    </div>
    <div class="bd-composer-wrap">${composerHtml(ctx)}</div>
    <div class="bd-feed">${feedHtml(ctx)}</div>
    ${ctx.footHtml || ''}
  </div>`;
}

function paintParts(ctx) {
  if (!activeView || !activeView.isConnected) return;
  const page = activeView.querySelector('.bd-page');
  if (!page) return;
  const lang = ctx.lang === 'en' ? 'en' : 'zh';
  const t = T[lang];
  const cur = activeFilter(ctx);

  page.querySelectorAll('[data-bd-filter]').forEach(btn => {
    btn.setAttribute('aria-selected', String(btn.dataset.bdFilter === cur));
  });
  const countEl = page.querySelector('#bd-count');
  if (countEl) countEl.textContent = posts.length ? t.countN(posts.length) : '';

  const compWrap = page.querySelector('.bd-composer-wrap');
  const activeEl = document.activeElement;
  if (compWrap && (!activeEl || !compWrap.contains(activeEl))) {
    compWrap.innerHTML = composerHtml(ctx);
  }

  const feedEl = page.querySelector('.bd-feed');
  if (feedEl && (!activeEl || !feedEl.contains(activeEl) || !activeEl.closest('.bd-reply-form'))) {
    feedEl.innerHTML = feedHtml(ctx);
  }
}

async function load(ctx, { append = false, force = false } = {}) {
  const cur = activeFilter(ctx);
  const sig = authSignature();
  if (!append && !force && loadedOnce && loadedFilter === cur && loadedAuthKey === sig) {
    paintParts(ctx);
    return;
  }

  const seq = ++loadSeq;
  loading = true;
  errorKind = '';
  errorMsg = '';
  if (!append) paintParts(ctx);

  try {
    await window.MG?.ready;
  } catch {}
  if (seq !== loadSeq) return;

  if (!window.MG?.client || !window.MG?.available) {
    loading = false;
    loadedOnce = true;
    loadedFilter = cur;
    loadedAuthKey = authSignature();
    errorKind = 'offline';
    paintParts(ctx);
    return;
  }

  try {
    const offset = append ? posts.length : 0;
    let query = MG.client
      .from('mg_comments')
      .select('id,parent_id,subject,title,body,user_id,author_name,is_teacher,pinned,created_at')
      .is('parent_id', null);

    if (cur !== 'all') query = query.eq('subject', cur);

    const { data, error } = await query
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE);

    if (seq !== loadSeq) return;
    if (error) throw error;

    const rows = data || [];
    hasMore = rows.length > PAGE_SIZE;
    const pageRows = rows.slice(0, PAGE_SIZE);
    posts = append ? [...posts, ...pageRows] : pageRows;

    if (!append) repliesByParent = new Map();
    const ids = pageRows.map(r => r.id);
    if (ids.length) {
      const { data: replyRows, error: replyErr } = await MG.client
        .from('mg_comments')
        .select('id,parent_id,subject,body,user_id,author_name,is_teacher,created_at')
        .in('parent_id', ids)
        .order('created_at', { ascending: true });
      if (seq !== loadSeq) return;
      if (replyErr) throw replyErr;
      for (const r of replyRows || []) {
        const list = repliesByParent.get(r.parent_id) || [];
        list.push(r);
        repliesByParent.set(r.parent_id, list);
      }
    }

    loadedOnce = true;
    loadedFilter = cur;
    loadedAuthKey = authSignature();
  } catch (err) {
    if (seq !== loadSeq) return;
    if (isMissingTableError(err)) {
      errorKind = 'setup';
    } else {
      errorKind = 'error';
      errorMsg = mapError(err, T[ctx.lang === 'en' ? 'en' : 'zh']);
    }
  } finally {
    if (seq === loadSeq) {
      loading = false;
      paintParts(ctx);
    }
  }
}

function bind(page, getCtx) {
  if (page.dataset.bdBound) return;
  page.dataset.bdBound = '1';

  page.addEventListener('input', e => {
    const comp = e.target.closest('#bd-composer-form');
    if (comp) {
      const d = {
        subject: comp.subject.value,
        title: comp.title.value,
        body: comp.body.value,
        pinned: !!comp.pinned?.checked
      };
      writeDraft(d);
      const countEl = comp.querySelector('#bd-char-count');
      if (countEl) countEl.textContent = `${d.body.length} / ${MAX_BODY}`;
      return;
    }
    const rf = e.target.closest('[data-bd-reply-form]');
    if (rf) {
      writeReplyDraft(rf.dataset.bdReplyForm, rf.body.value);
    }
  });

  page.addEventListener('change', e => {
    const comp = e.target.closest('#bd-composer-form');
    if (comp) {
      writeDraft({
        subject: comp.subject.value,
        title: comp.title.value,
        body: comp.body.value,
        pinned: !!comp.pinned?.checked
      });
    }
  });

  page.addEventListener('click', async e => {
    const ctx = getCtx();
    const t = T[ctx.lang === 'en' ? 'en' : 'zh'];

    const filterBtn = e.target.closest('[data-bd-filter]');
    if (filterBtn) {
      const next = filterBtn.dataset.bdFilter;
      if (FILTERS.includes(next)) {
        filter = next;
        openReplyId = '';
        posts = [];
        repliesByParent = new Map();
        hasMore = false;
        load(ctx, { force: true });
      }
      return;
    }

    if (e.target.closest('[data-bd-refresh]')) {
      load(ctx, { force: true });
      return;
    }

    if (e.target.closest('[data-bd-more]')) {
      if (!loading && hasMore) load(ctx, { append: true });
      return;
    }

    const replyToggle = e.target.closest('[data-bd-reply-toggle]');
    if (replyToggle) {
      const id = replyToggle.dataset.bdReplyToggle;
      openReplyId = openReplyId === id ? '' : id;
      replyMsg = { id: '', text: '', kind: '' };
      paintParts(ctx);
      if (openReplyId) {
        page.querySelector(`[data-bd-reply-form="${CSS.escape(openReplyId)}"] textarea`)?.focus();
      }
      return;
    }

    if (e.target.closest('[data-bd-reply-cancel]')) {
      openReplyId = '';
      replyMsg = { id: '', text: '', kind: '' };
      paintParts(ctx);
      return;
    }

    const pinBtn = e.target.closest('[data-bd-pin]');
    if (pinBtn) {
      const id = pinBtn.dataset.bdPin;
      const nextPinned = pinBtn.dataset.bdPinned !== '1';
      pinBtn.disabled = true;
      try {
        const { error } = await MG.client.rpc('mg_board_set_pin', { p_id: id, p_pinned: nextPinned });
        if (error) throw error;
        await load(ctx, { force: true });
      } catch (err) {
        pinBtn.disabled = false;
        alert(mapError(err, t));
      }
      return;
    }

    const delBtn = e.target.closest('[data-bd-del]');
    if (delBtn) {
      const isReply = delBtn.dataset.bdKind === 'reply';
      if (!confirm(isReply ? t.delReplyConfirm : t.delPostConfirm)) return;
      const id = delBtn.dataset.bdDel;
      delBtn.disabled = true;
      try {
        const { error } = await MG.client.from('mg_comments').delete().eq('id', id);
        if (error) throw error;
        if (!isReply && openReplyId === id) openReplyId = '';
        await load(ctx, { force: true });
      } catch (err) {
        delBtn.disabled = false;
        alert(mapError(err, t));
      }
    }
  });

  page.addEventListener('submit', async e => {
    const ctx = getCtx();
    const t = T[ctx.lang === 'en' ? 'en' : 'zh'];

    if (e.target.id === 'bd-composer-form') {
      e.preventDefault();
      if (!window.MG?.user) return;
      const f = e.target;
      const subj = FILTERS.includes(f.subject.value) ? f.subject.value : 'all';
      const title = f.title.value.trim().slice(0, MAX_TITLE);
      const body = f.body.value.trim();
      const pinned = !!(MG.teacher && f.pinned?.checked);

      if (!body) {
        composerMsg = { text: t.needBody, kind: 'err' };
        paintParts(ctx);
        return;
      }
      if (body.length > MAX_BODY) {
        composerMsg = { text: t.tooLong, kind: 'err' };
        paintParts(ctx);
        return;
      }

      const btn = f.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = t.submitting;
      composerMsg = { text: '', kind: '' };

      try {
        const { error } = await MG.client.from('mg_comments').insert({
          parent_id: null,
          subject: subj,
          title,
          body,
          user_id: MG.user.id,
          pinned
        });
        if (error) throw error;
        writeDraft(null);
        f.title.value = '';
        f.body.value = '';
        if (f.pinned) f.pinned.checked = false;
        composerMsg = { text: t.posted, kind: 'ok' };
        if (filter !== 'all' && filter !== subj) filter = subj;
        await load(ctx, { force: true });
      } catch (err) {
        composerMsg = { text: mapError(err, t), kind: 'err' };
        btn.disabled = false;
        btn.textContent = t.submitPost;
        const msgEl = f.querySelector('.bd-msg');
        if (msgEl) {
          msgEl.className = 'bd-msg err';
          msgEl.textContent = composerMsg.text;
        }
      }
      return;
    }

    const rf = e.target.closest('[data-bd-reply-form]');
    if (rf) {
      e.preventDefault();
      if (!window.MG?.user) return;
      const postId = rf.dataset.bdReplyForm;
      const post = posts.find(x => x.id === postId);
      if (!post) return;
      const body = rf.body.value.trim();
      if (!body) {
        replyMsg = { id: postId, text: t.needBody, kind: 'err' };
        paintParts(ctx);
        return;
      }
      if (body.length > MAX_BODY) {
        replyMsg = { id: postId, text: t.tooLong, kind: 'err' };
        paintParts(ctx);
        return;
      }

      const btn = rf.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = t.submitting;
      replyMsg = { id: '', text: '', kind: '' };

      try {
        const { error } = await MG.client.from('mg_comments').insert({
          parent_id: postId,
          subject: post.subject,
          title: '',
          body,
          user_id: MG.user.id
        });
        if (error) throw error;
        writeReplyDraft(postId, '');
        openReplyId = '';
        await load(ctx, { force: true });
      } catch (err) {
        replyMsg = { id: postId, text: mapError(err, t), kind: 'err' };
        btn.disabled = false;
        btn.textContent = t.replySubmit;
        paintParts(ctx);
      }
    }
  });
}

function mount(viewEl, ctx) {
  activeView = viewEl;
  lastCtx = ctx;
  const page = viewEl.querySelector('.bd-page');
  if (!page) return;
  bind(page, () => lastCtx || ctx);
  load(ctx);
}

return { renderHtml, mount, setSubject };
})();
