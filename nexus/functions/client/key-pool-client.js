/* ============================================================
   NEXUS · API KEY POOL — the browser side, as a standalone module.
   (NEXUS itself has the same thing built in: index.html → PART 32.
   This file is for any other page of the project that wants it.)

   1. donateKey(): writes the key ONCE into Firestore «api_keys».
      firestore.rules allow exactly that — nobody can read it back.
   2. processRequest(): sends a question to the Cloud Function and returns
      the answer. The key never reaches the browser.
   3. mountDonateForm(): a small form (a field + a button) that uses 1.

   Usage (see example.html):
     import { mountDonateForm, processRequest } from './key-pool-client.js';
     mountDonateForm(document.querySelector('#pool'), { db, auth });
     const r = await processRequest(auth, { messages: [{ role: 'user', content: 'Hi' }] },
                                    { url: 'https://us-central1-<project>.cloudfunctions.net/processRequest' });
     console.log(r.text);
   ============================================================ */
import { doc, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/* each account has five slots: api_keys/<uid>_0 … <uid>_4 */
export const SLOTS = 5;

/* the key formats the rules accept (the same patterns as firestore.rules) */
const KINDS = [
  ['groq', /^gsk_[A-Za-z0-9]{20,}$/],
  ['openrouter', /^sk-or-[A-Za-z0-9_-]{20,}$/],
  ['gemini', /^(AIza[0-9A-Za-z_-]{30,}|AQ\.[0-9A-Za-z_.-]{20,})$/]
];

/* an error with a short machine-readable code next to a readable message */
class PoolError extends Error {
  constructor(code, message, status) { super(message); this.code = code; this.status = status || 0; }
}

/* 'groq' | 'openrouter' | 'gemini' | null */
export function providerOf(key) {
  const k = String(key || '').trim();
  const hit = KINDS.find(([, re]) => re.test(k));
  return hit ? hit[0] : null;
}

/* ----------------------------------------------------------------
   donateKey — write the key into the first free slot.
   A slot that already holds a key cannot be written again (the rules
   allow «create» only), so a refused slot just means «try the next».
   Returns { slot, provider, tail } — tail = «••••» + the last 4 chars.
   ---------------------------------------------------------------- */
export async function donateKey(db, auth, rawKey) {
  const key = String(rawKey || '').trim().replace(/\s+/g, '');
  const provider = providerOf(key);
  if (!provider) throw new PoolError('format', 'هذا لا يشبه مفتاح Gemini (AIza… أو AQ.…) أو Groq (gsk_…) أو OpenRouter (sk-or-…)');
  if (key.length > 200) throw new PoolError('format', 'المفتاح أطول من اللازم');

  const user = auth.currentUser;
  if (!user || user.isAnonymous) throw new PoolError('signin', 'سجّل الدخول بحساب أولًا (حتى تستطيع سحب المفتاح لاحقًا)');

  for (let i = 0; i < SLOTS; i++) {
    try {
      await setDoc(doc(db, 'api_keys', user.uid + '_' + i), {
        key,
        provider,
        createdAt: serverTimestamp(),   // the rules require the server's time
        status: 'active',
        failCount: 0,
        donorUid: user.uid
      });
      return { slot: i, provider, tail: '••••' + key.slice(-4) };
    } catch (e) {
      if (e && e.code === 'permission-denied') continue;     // taken slot → the next one
      if (e && e.code === 'unavailable') throw new PoolError('offline', 'لا يوجد اتصال بقاعدة البيانات');
      throw new PoolError(e && e.code || 'write', 'تعذّر حفظ المفتاح: ' + (e && e.message || e));
    }
  }
  throw new PoolError('full', 'لكل حساب ' + SLOTS + ' مفاتيح كحدّ أقصى — اسحب مفتاحًا أولًا');
}

/* withdrawKey — the donor deletes their own slot (the only thing the rules let them do with it) */
export async function withdrawKey(db, auth, slot) {
  const user = auth.currentUser;
  if (!user) throw new PoolError('signin', 'سجّل الدخول أولًا');
  try { await deleteDoc(doc(db, 'api_keys', user.uid + '_' + slot)); }
  catch (e) { if (!(e && e.code === 'permission-denied')) throw e; }   // already gone
}

/* ----------------------------------------------------------------
   processRequest — a question in, the answer out.
   payload: { messages: [{role, content}], provider?, model?, max_tokens?, temperature? }
   returns: { ok, text, provider, model, usage: { in, out } }
   Errors carry .code: signin · unreachable · rate_limit · no_keys ·
   all_failed · bad_request · bad_provider · bad_model · http_<status>
   ---------------------------------------------------------------- */
export async function processRequest(auth, payload, { url, timeoutMs = 90000 } = {}) {
  if (!url) throw new PoolError('config', 'عنوان processRequest غير محدَّد');
  if (!payload || !Array.isArray(payload.messages) || !payload.messages.length) throw new PoolError('bad_request', 'لا توجد رسالة');
  const user = auth.currentUser;
  if (!user) throw new PoolError('signin', 'سجّل الدخول أولًا');
  const token = await user.getIdToken();

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify(payload),
      signal: ctl.signal
    });
  } catch (e) {
    throw new PoolError('unreachable', e && e.name === 'AbortError'
      ? 'لم تُجب processRequest في الوقت المحدد'
      : 'تعذّر الوصول إلى processRequest (غير منشورة — تحتاج خطة Blaze — أو الشبكة مقطوعة)');
  } finally { clearTimeout(timer); }

  const body = await res.json().catch(() => null);
  if (!res.ok || !body || !body.ok) {
    const err = body && body.error;
    throw new PoolError(err && err.code || 'http_' + res.status, err && err.message || 'HTTP ' + res.status, res.status);
  }
  return body;
}

/* ----------------------------------------------------------------
   mountDonateForm — a password field, a consent box, a button, a line
   for the result. Nothing is kept in the page after sending.
   ---------------------------------------------------------------- */
export function mountDonateForm(container, { db, auth, onDonated } = {}) {
  const form = document.createElement('form');
  form.className = 'key-pool-form';
  form.innerHTML =
    '<label>مفتاحك<br><input type="password" name="key" autocomplete="off" spellcheck="false" ' +
    'placeholder="gsk_… / AIza… / AQ.… / sk-or-…" style="width:100%;direction:ltr"></label>' +
    '<div class="kind" aria-live="polite"></div>' +
    '<label><input type="checkbox" name="agree"> المفتاح ملكي، وأسمح باستعماله للذكاء المجاني في هذا الموقع، وأعرف أنني أستطيع سحبه متى شئت.</label><br>' +
    '<button type="submit">🤝 تبرّع بالمفتاح</button>' +
    '<div class="msg" role="status"></div>';
  const input = form.elements.key, agree = form.elements.agree, button = form.querySelector('button');
  const kind = form.querySelector('.kind'), msg = form.querySelector('.msg');
  const say = (text, bad) => { msg.textContent = text; msg.style.color = bad ? '#c0392b' : '#1e8449'; };

  /* recognise the key while typing, before anything is sent */
  input.addEventListener('input', () => {
    const p = providerOf(input.value);
    kind.textContent = !input.value ? '' : p ? '✓ مفتاح ' + p : '✗ لا يشبه مفتاحًا مدعومًا';
  });

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    if (!agree.checked) return say('وافق أولًا على استعمال المفتاح', true);
    button.disabled = true;
    say('جارٍ الإرسال…');
    try {
      const r = await donateKey(db, auth, input.value);
      input.value = ''; kind.textContent = '';
      say('شكرًا! أُضيف مفتاح ' + r.provider + ' ' + r.tail + ' إلى المجمّع');
      if (onDonated) onDonated(r);
    } catch (e) {
      say(e.message, true);
    } finally {
      button.disabled = false;
    }
  });
  container.appendChild(form);
  return form;
}
