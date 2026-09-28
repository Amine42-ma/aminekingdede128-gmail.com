# 🤝 مجمّع مفاتيح الذكاء (API Key Pool)

اللاعبون يتبرّعون بمفاتيح Gemini أو Groq أو OpenRouter الخاصة بهم، والموقع يستعملها للذكاء المجاني. **لا يستطيع أحد قراءة المفتاح بعد إرساله:** لا الزوار، ولا البوتات، ولا المتبرّع نفسه.

## كيف يعمل

```
المتصفح ──(رمز تسجيل الدخول + السؤال)──▶ processRequest
processRequest ──(Admin SDK — القواعد لا تنطبق عليه)──▶ Firestore api_keys
processRequest ──(مفتاح نشط يُختار عشوائيًا)──▶ المزوّد
processRequest ──(الجواب فقط)──▶ المتصفح
```

| الجزء | الملف | ماذا يفعل |
|---|---|---|
| قواعد الأمان | `../firestore.rules` ← `match /api_keys/{keyId}` | `allow read: if false` · الإضافة فقط بالحقول `key` و `createdAt` (وقت الخادم) و `status: "active"` و `failCount: 0` و `donorUid` · لا تعديل · الحذف للمتبرّع وحده |
| الدالة السحابية | `index.js` ← `processRequest` | تقرأ المفاتيح النشطة، تختار واحدًا عشوائيًا (Random Rotation)، ترسل الطلب، وترجع الجواب فقط. عند 401/403 تجعل المفتاح `status: "disabled"` (سبب `invalid`)، وعند 429/402 تجعله `disabled` مؤقتًا (سبب `rate-limit` مع `reviveAt`) ثم تجرّب مفتاحًا آخر تلقائيًا |
| الواجهة داخل NEXUS | `../index.html` ← PART 32 (`NX.KeyPool`) | الإعدادات ← «🤝 تبرّع بمفتاح للذكاء المجاني»: خانة + زر + موافقة، قائمة «مفاتيحك» (••••آخر 4 أحرف والحالة)، زر «سحب» |
| واجهة مستقلة | `client/key-pool-client.js` و `client/example.html` | نفس الشيء كوحدة JavaScript لأي صفحة أخرى: `mountDonateForm()` و `donateKey()` و `withdrawKey()` و `processRequest()` |
| خادم الذكاء في الموقع | `../netlify/edge-functions/ai.js` | إذا وُضع `FIREBASE_SERVICE_ACCOUNT` في Netlify يستعمل المفاتيح المتبرَّع بها أيضًا (بعد مفاتيح الموقع) ويعطّل المرفوض — **يعمل بدون خطة Blaze** |

## الحماية

- **القراءة ممنوعة نهائيًا من المتصفح** (`allow read: if false`)، والتعديل ممنوع، فلا يستطيع أحد تغيير `status` أو `failCount` إلا الخادم.
- **العنوان ثابت في الخادم:** المتصفح يختار المزوّد والنموذج فقط، لا يختار الرابط. (لو استطاع اختيار الرابط لأرسل الخادمُ المفتاحَ إلى خادمه هو.)
- **رمز تسجيل دخول Firebase مطلوب** والضيوف مرفوضون (إلا بـ `POOL_ALLOW_ANONYMOUS=1`)، و**حدّ لكل لاعب في الدقيقة** (`POOL_PER_MINUTE`، افتراضيًا 20).
- **أي نص يشبه مفتاحًا يُحذف من رسائل الخطأ** قبل إرجاعها، والسجلات تذكر رقم المستند فقط.
- **5 مفاتيح كحدّ أقصى لكل حساب** (`<uid>_0` … `<uid>_4`)، فلا يستطيع أحد إغراق المجمّع.
- **المفتاح نفسه لا يُقبل مرتين:** مع المفتاح تُرسل بصمته SHA-256 (`keyHash`) ويُكتب `api_key_hashes/<hash>` في نفس العملية؛ القواعد تحسب البصمة من المفتاح بنفسها (`hashing.sha256`) وترفض بصمة موجودة. البصمة لا تكشف شيئًا من المفتاح.

## النشر

1. الدالة السحابية تحتاج **خطة Blaze** في Firebase (Cloud Functions غير متاحة في الخطة المجانية Spark).
2. من مجلد `nexus`:
   ```
   cd functions && npm install && cd ..
   firebase deploy --only firestore:rules,functions:processRequest
   ```
3. الرابط الذي يطبعه الأمر يكون عادةً `https://us-central1-<PROJECT_ID>.cloudfunctions.net/processRequest`، وNEXUS يستعمله وحده. إن اخترت منطقة أخرى (`POOL_REGION`) ضع الرابط في أعلى `index.html`:
   ```
   window.NEXUS_KEYPOOL_URL = 'https://…/processRequest';
   ```
4. إعدادات اختيارية: انسخ `.env.example` إلى `.env` (الحدّ في الدقيقة، أطول جواب، النطاقات المسموحة `POOL_ALLOWED_ORIGINS`، النماذج الافتراضية).

**بدون Blaze:** ضع `FIREBASE_SERVICE_ACCOUNT` في Netlify (Site configuration ← Environment variables، ثم Trigger deploy)، فيستعمل خادم الذكاء في الموقع المفاتيح المتبرَّع بها. نافذة التبرّع تقول لك أيّ الاثنين يعمل الآن.

## الطلب والجواب

```
POST processRequest
Authorization: Bearer <Firebase ID token>
{ "messages": [{ "role": "user", "content": "مرحبا" }],
  "provider": "groq",          // اختياري: gemini | groq | openrouter
  "model": "…",                // اختياري
  "max_tokens": 512 }

200 → { "ok": true, "text": "…", "provider": "groq", "model": "…", "usage": { "in": 7, "out": 5 } }
خطأ → { "ok": false, "error": { "code": "rate_limit | no_keys | all_failed | bad_model | …", "message": "…" } }
```

`GET processRequest?mine=1` (مع الرمز) يرجع عدد المفاتيح النشطة لكل مزوّد، ومفاتيحك أنت فقط: المزوّد و«••••آخر 4 أحرف» والحالة.

## حدود يجب أن تعرفها

- **صاحب مشروع Firebase يستطيع رؤية المفاتيح** من لوحة Firebase (Firestore) — القواعد تمنع المتصفحات فقط. لذلك تقول نافذة التبرّع هذا بوضوح.
- **شروط بعض المزوّدين قد تمنع مشاركة المفاتيح.** على المتبرّع أن يتأكد من شروط مزوّده، والنافذة تنبّهه إلى ذلك.
- المفتاح الذي وصل حدّه يعود وحده بعد وقت الراحة (من `retry-after` أو رسالة المزوّد، من 30 ثانية إلى ساعة، و6 ساعات لنفاد الحصة اليومية). المفتاح المرفوض يبقى معطّلًا حتى يسحبه صاحبه.

## الاختبار المحلي

```
firebase emulators:start --only auth,firestore,functions
```
المحاكي يقرأ `functions/.env.local` (مثلًا `GROQ_BASE=http://127.0.0.1:8091/groq` لمزوّد تجريبي)، وافتح `client/example.html?emulators=1`.
