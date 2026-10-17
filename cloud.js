/* Shared account and result service. All access is enforced by database RLS. */
window.MG = (() => {
  'use strict';
  const config = window.READING_CONFIG || {};
  const configured = config.enabled && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url) && config.publishableKey;
  const client = configured && window.supabase ? window.supabase.createClient(config.url, config.publishableKey, {
    global: { fetch: (url, options={}) => fetch(url, {...options, signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000)}) },
    auth: { storageKey: 'mg-auth-v1', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  }) : null;
  let user = null, teacher = false, available = false, recovery = /type=recovery/.test(location.hash), syncing = false, error = '', identity;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key = name => user ? `${name}:user:${user.id}` : name;
  const read = (name, fallback) => { try { return JSON.parse(localStorage.getItem(key(name))) ?? fallback; } catch { return fallback; } };
  function write(name, value) { try { localStorage.setItem(key(name), JSON.stringify(value)); return true; } catch { error = 'Browser storage is unavailable. Keep this page open until results are synced.'; status(); return false; } }
  function status() {
    const bar = document.getElementById('mg-account-bar');
    if (!bar) return;
    const pending = user ? read('mg-pending', []).length : 0;
    bar.innerHTML = `<a href="account.html">${user ? escape(user.user_metadata?.display_name || user.email) : '登录 / 注册 · Sign in'}</a><span>${escape(error || (!available ? 'Cloud setup pending · 试做保存在本机' : user ? (pending ? `${pending} result(s) awaiting sync` : 'Cloud connected') : 'Guest · 本机体验'))}</span>${user ? '<a href="account.html">我的成绩</a>' : ''}${teacher ? '<a href="account.html?view=teacher">教师后台</a>' : ''}${pending ? '<button type="button" id="mg-retry">Retry sync</button>' : ''}`;
    document.getElementById('mg-retry')?.addEventListener('click', sync);
  }
  function mount() { if (!document.getElementById('mg-account-bar')) { const bar = document.createElement('div'); bar.id = 'mg-account-bar'; bar.className = 'mg-account-bar'; bar.setAttribute('aria-label', 'Account and sync status'); document.body.prepend(bar); } status(); }
  async function ensureProfile() {
    const {data, error: e} = await client.from('mg_profiles').select('id').eq('id', user.id).maybeSingle();
    if (e) throw e;
    if (!data) {
      const {error: insertError} = await client.from('mg_profiles').insert({id:user.id, display_name:(user.user_metadata?.display_name || user.email.split('@')[0]).slice(0,80)});
      if (insertError && insertError.code !== '23505') throw insertError;
    }
  }
  const ready = (async () => {
    if (!client) return;
    client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') recovery = true;
      if (identity !== undefined && (session?.user?.id || null) !== identity) location.reload();
    });
    try {
      const {data: {session}, error: authError} = await client.auth.getSession();
      if (authError) throw authError;
      user = session?.user || null; identity = user?.id || null;
      const {data: version, error: versionError} = await client.rpc('mg_backend_version');
      if (versionError || version !== 1) throw Error('Cloud setup pending · 数据库尚未安装或暂时无法连接');
      available = true;
      if (user) {
        await ensureProfile();
        const result = await client.rpc('mg_is_teacher');
        if (result.error) throw result.error;
        teacher = result.data === true;
      }
    } catch (e) { error = e.message || 'Cloud connection unavailable'; }
    finally { mount(); }
  })();
  async function sync() {
    await ready;
    if (!user || !available || syncing) return;
    syncing = true;
    try {
      for (const row of read('mg-pending', [])) {
        if (row.student_id !== user.id) continue;
        const {error: e} = await client.from('mg_attempts').insert(row);
        // Immutable rows + composite primary key make retries safe after a lost response.
        if (e && e.code !== '23505') throw e;
        write('mg-synced', {...read('mg-synced',{}),[row.id]:true});
        if (!write('mg-pending', read('mg-pending', []).filter(r => r.id !== row.id))) break;
      }
      error = '';
    } catch { error = 'Cloud sync failed. Results kept on this device; retry when connected.'; }
    finally { syncing = false; status(); }
  }
  async function submit(row) {
    await ready;
    if (!user) return false;
    if(read('mg-synced',{})[row.id])return true;
    const payload = {...row, student_id:user.id};
    const pending = read('mg-pending', []);
    if (!pending.some(r => r.id === row.id)) {
      if (!write('mg-pending', [...pending, payload])) {
        const {error: e} = await client.from('mg_attempts').insert(payload);
        if (e && e.code !== '23505') throw Error('Could not save results. Keep this page open and retry.');
        return true;
      }
    }
    status(); await sync(); return true;
  }
  async function rows(kind) {
    await ready;
    if (!available || !user) return [];
    const result = []; let offset = 0;
    while (true) {
      let query = client.from('mg_attempts').select('*').eq('student_id',user.id).order('submitted').order('id').range(offset,offset+499);
      if (kind) query = query.eq('kind',kind);
      const {data,error:e} = await query;
      if (e) throw e;
      result.push(...data); if (data.length < 500) break; offset += 500;
    }
    const byId = new Map(result.map(r=>[r.id,r]));
    for (const r of read('mg-pending', [])) if (!kind || r.kind===kind) byId.set(r.id,r);
    return [...byId.values()].sort((a,b)=>a.submitted.localeCompare(b.submitted));
  }
  ready.then(()=>{mount();sync();});
  window.addEventListener('online', sync);
  window.addEventListener('hashchange',()=>{if(/(?:access_token|error_description)=/.test(location.hash))location.reload()});
  setInterval(sync, 30000);
  return {ready,client,escape,key,read,write,submit,sync,rows,status,
    get user(){return user},get teacher(){return teacher},get available(){return available},get recovery(){return recovery},
    get error(){return error},get configured(){return !!configured}};
})();
