# NEXUS — منصة ألعاب مشتركة على Netlify + Firebase

هذا المجلد هو موقع NEXUS كاملًا (ملف `index.html` واحد) مع ملفات إعداد Firebase و Netlify.

| الملف | ما هو |
|---|---|
| `index.html` | NEXUS نفسه. **إعداد Firebase في أعلى الملف فقط** (ابحث عن `NEXUS_FIREBASE:BEGIN`). |
| `firestore.rules` | قواعد Firestore: الألعاب العامة مقروءة للجميع، المشاريع للمالك فقط، العدادات تُفرض على الخادم. |
| `storage.rules` | قواعد Storage: الأصول الخاصة للمالك فقط، ملفات اللعبة تتبع خصوصية اللعبة، لا كتابة على مسارات الآخرين. |
| `firestore.indexes.json` | الفهارس التي تستعملها قوائم الألعاب والأصول والبحث. |
| `firebase.json` | لنشر القواعد والفهارس بأمر واحد، ولتشغيل المحاكيات محليًا. |
| `cors.json` | يسمح لموقعك بتنزيل ملفات Storage (المجسمات والأصوات) — بدونه لا تُحمَّل الأصول على الأجهزة الأخرى. |
| `_headers` / `netlify.toml` | إعداد Netlify: `index.html` لا يُخزَّن قديمًا، فيصل أي تحديث لكل الهواتف فورًا. |

## لماذا لم تظهر اللعبة على الهاتف الثاني؟

كان `NEXUS_FIREBASE` فارغًا، والنسخة القديمة كانت تبحث عن الإعداد في `/__/firebase/init.json` — وهذا المسار موجود فقط على Firebase Hosting وليس على Netlify. فكان كل هاتف يعمل في **LOCAL MODE** ويحفظ ألعابه في IndexedDB الخاص به فقط، ولا يوجد أي مصدر بيانات مشترك.

## خطوات التشغيل (مرة واحدة من صاحب المنصة)

1. **Firebase Console → Build → Authentication → Sign-in method**: فعّل **Anonymous** و **Email/Password** و **Google**.
2. **Firestore Database → Create database** (Production mode).
3. **Storage → Get started**. (المشاريع الجديدة تحتاج خطة **Blaze** لإنشاء حاوية Storage؛ الاستخدام الصغير يبقى ضمن الحصة المجانية. بدون Storage يعمل النشر، لكن لا يمكن رفع المجسمات والأغلفة.)
4. **Project settings → General → Your apps → Web app (</>)** → انسخ `firebaseConfig`.
5. ✅ **تم** — إعداد المشروع `jknbb-n` مضمّن في أعلى `index.html` داخل الكتلة (لتغييره لاحقًا عدّل نفس الكتلة):
   ```js
   /* NEXUS_FIREBASE:BEGIN */
   window.NEXUS_FIREBASE = { apiKey: "…", authDomain: "…", projectId: "…", storageBucket: "…", messagingSenderId: "…", appId: "…" };
   /* NEXUS_FIREBASE:END */
   ```
   أو من الهاتف: افتح NEXUS ← ⚙ الإعدادات ← **التشخيص** ← **إعداد Firebase للمالك** ← الصق الإعداد ← «اختبار» ← «تنزيل index.html مُعدّ».
   هذا الإعداد ليس سرًا (يعرّف المشروع فقط). لا تضع أبدًا مفتاح Service Account أو Admin SDK أو مفتاح AI هنا.
6. **انشر القواعد والفهارس** (من هذا المجلد، على حاسوب أو Cloud Shell):
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use jknbb-n
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```
   (عند نشر storage.rules سيطلب الإذن للقواعد المتقاطعة مع Firestore — وافق.)
7. **CORS لحاوية Storage**: عدّل `cors.json` وضع رابط موقعك بدل `https://YOUR-SITE.netlify.app`، ثم في Google Cloud Shell:
   ```bash
   gsutil cors set cors.json gs://jknbb-n.firebasestorage.app
   ```
8. **Authentication → Settings → Authorized domains**: أضف `YOUR-SITE.netlify.app` (مطلوب لتسجيل الدخول بـ Google).
9. **Netlify**: اسحب مجلد `nexus` كاملًا إلى Netlify Drop، أو اربط المستودع واجعل *Base directory* = `nexus`. الموقع يعمل عبر HTTPS تلقائيًا.

## التحقق من أن الهاتفين على نفس المشروع

افتح الموقع على كل هاتف ← ⚙ ← **التشخيص**. يجب أن يظهر في الهاتفين:

- `Firebase: CONNECTED` و `Mode: FIREBASE`
- نفس `Firebase Project`
- `Games (زائر آخر): READABLE` — هذا فحص حقيقي بجلسة غير مسجّلة، أي ما يراه هاتف آخر
- `آخر لعبة لك: ✓ الزائر يقرأ السجل والنسخة القابلة للتشغيل`
- `Storage: AVAILABLE` و `Storage CORS: OK`

مؤشر الحالة أعلى الشاشة: **Online** (أخضر) = بيانات مشتركة · **Local Mode** (برتقالي) = لا يوجد إعداد، هذا الجهاز فقط · **Firebase Error** (أحمر) = يوجد إعداد لكن الاتصال فشل (السبب الحقيقي داخل المؤشر).

## اختبار الهاتفين (النهائي)

1. الهاتف A: افتح الرابط ← الحساب ← تسجيل الدخول ← أنشئ لعبة باسم `TEST NEXUS SHARED GAME` ← نشر ← عام.
   تظهر نافذة «تم النشر» فقط بعد أن يُقرأ السجل من الخادم نفسه.
2. الهاتف B: افتح نفس الرابط ← سجّل بحساب آخر ← الرئيسية أو المجتمع ← ألعاب ← ابحث عن الاسم ← افتح ← تشغيل.

## اختبار محلي بمحاكيات Firebase (بدون مشروع حقيقي)

```bash
cd nexus
firebase emulators:start --project demo-nexus --only auth,firestore,storage
python3 -m http.server 8000          # في نافذة أخرى
# ثم افتح: http://localhost:8000/index.html?emulators=1  (في متصفحين مختلفين = هاتفان)
```

## أوامر المساعد (تنفَّذ فعليًا على المشروع، بمزوّد AI أو بدونه)

- «أضف سيارة رياضية قرب المبنى» · «اجعلها أكبر» · «ضعها خلف المنزل» · «لف السيارة 90 درجة»
- «استبدل السيارة بسيارة أخرى من أصولي» · «ابحث في المكتبة العامة عن شجرة» · «ضع ثلاث سيارات أمام المبنى»
- «ضع الأشجار حول المنطقة» (يسأل عن العدد ويعرض معاينة قبل التطبيق) · «احذف السيارة» · «انسخ السيارة»
- «ماذا يوجد في المشهد؟» · «حلل لعبتي» · «أصلح الخطأ الموجود في الكود» · «ما حالة اللعبة الآن؟» · «تراجع»
- بمزوّد AI متصل: «اجعل الباب يفتح عند الاقتراب» → تعديل كود مع عرض الفرق قبل التطبيق.

الاتجاهات (أمام/خلف/يمين/يسار) تُحسب من زاوية الكاميرا الحالية كما تراها على الشاشة.
