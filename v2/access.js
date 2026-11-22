'use strict';
/* Lesson access for v2. Registered students use the shared v1 session (MG.client).
   Guests who enter a weekly code get an anonymous Supabase account stored under its OWN key,
   so v1 pages (mock.html, act.html, account.html) never see it. */
window.MGAccess = (() => {
const BUCKET = 'mg-lessons';
let guest = null;
function guestClient() {
  const c = window.READING_CONFIG;
  if (!guest && c?.enabled && window.supabase) {
    guest = window.supabase.createClient(c.url, c.publishableKey, {
      auth: { storageKey: 'mg-v2-guest', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
  }
  return guest;
}
async function client(create = false) {
  await MG.ready;
  if (MG.user && MG.client) return MG.client;
  const g = guestClient();
  if (!g) return null;
  const { data: { session } } = await g.auth.getSession();
  if (session) return g;
  if (!create) return null;
  const { error } = await g.auth.signInAnonymously();
  if (error) { const e = Error(error.message); e.code = 'anon'; throw e; }
  return g;
}
/* { sat: {can_view, approved, expires_at}, act: …, math: … } — empty when there is no session yet. */
async function status() {
  const c = await client();
  if (!c) return {};
  const { data, error } = await c.rpc('mg_lesson_status');
  if (error) throw error;
  return Object.fromEntries(data.map(r => [r.subject, r]));
}
/* 'ok' | 'wrong' | 'wait' */
async function unlock(subject, code) {
  const c = await client(true);
  const { data, error } = await c.rpc('mg_lesson_unlock', { p_subject: subject, p_code: code });
  if (error) throw error;
  return data;
}
const cacheKey = item => `https://mg-lessons.invalid/${item.key}?v=${MGLessons.VERSION}`;
/* Call only after status() says the subject can be viewed. */
async function load(item) {
  try { const hit = await (await caches.open('mg-v2-lessons')).match(cacheKey(item)); if (hit) return await hit.text(); } catch {}
  const c = await client();
  if (!c) throw Object.assign(Error('locked'), { code: 'locked' });
  const { data, error } = await c.storage.from(BUCKET).download(item.key);
  if (error) throw Object.assign(Error(error.message || 'download failed'), { code: /not.?found|404/i.test(error.message || '') ? 'missing' : 'download' });
  const text = await data.text();
  try { await (await caches.open('mg-v2-lessons')).put(cacheKey(item), new Response(text, { headers: { 'content-type': 'text/html; charset=utf-8' } })); } catch {}
  return text;
}
async function forget() { try { await caches.delete('mg-v2-lessons'); } catch {} }
return { BUCKET, client, status, unlock, load, forget };
})();
