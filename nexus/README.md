# NEXUS — ملاحظات المالك

الملف كله في `index.html`. بجانبه ملفات Firebase التي تُنشر مرة واحدة من جهاز المالك.

| الملف | ما فيه |
|---|---|
| `index.html` | المنصة كاملة (محرك، محرر، IDE، AI، مجتمع، فيديو، بث) |
| `firestore.rules` | قواعد الأمان لكل المجموعات (ملكية، خصوصية، عدادات) |
| `storage.rules` | قواعد الملفات (أصول، وسائط، ألعاب) |
| `firestore.indexes.json` | الفهارس المركّبة التي تحتاجها الاستعلامات |
| `firebase.json` | إعداد النشر والمحاكيات المحلية |

## الخطوة الوحيدة المطلوبة من المالك: إعداد Firebase

1. افتح Firebase Console ← Project settings ← Your apps ← تطبيق الويب ← Config.
2. الصق القيم الست داخل `NEXUS_FIREBASE` في أعلى PART 3 من `index.html` (ابحث عن `const NEXUS_FIREBASE`).
   هذا هو المصدر الوحيد للإعداد. الزائر لا يرى أي شاشة Firebase ولا يدخل أي إعداد.
   إذا نُشرت المنصة على Firebase Hosting، فهي تقرأ الإعداد نفسه تلقائيًا من `/__/firebase/init.json` حتى لو بقي `NEXUS_FIREBASE` فارغًا.
3. في Console فعّل:
   - **Authentication**: Anonymous و Email/Password و Google، وأضف نطاق موقعك في Authorized domains.
   - **Firestore Database** و **Storage**.
4. انشر القواعد والفهارس (مرة واحدة، ومع كل تعديل عليها):

   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use <PROJECT_ID>
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```

   قواعد Storage تقرأ خصوصية الملف من Firestore (cross-service)، فوافق على طلب الصلاحية عند النشر.

عند الفتح يتحقق NEXUS فعليًا من الاتصال (دخول مجهول + قراءة من خادم Firestore). إذا نجح تظهر «متصل»، وإذا فشل يعمل محليًا ويعرض السبب الحقيقي في شارة الحالة وفي الإعدادات.

## اختبار محلي قبل النشر (محاكيات Firebase)

```bash
firebase emulators:start --project demo-nexus --only auth,firestore,storage
python3 -m http.server 8000
# افتح: http://localhost:8000/index.html?emulators=1
```

وضع المحاكيات يعمل على `localhost` فقط، وفقط مع `?emulators=1`.

## حدود حقيقية (مكتوبة أيضًا داخل الكود والواجهة)

- **البث المباشر** عبر WebRTC من جهاز المذيع مباشرة، ويناسب عددًا قليلًا من المشاهدين. بعض شبكات الهاتف تحتاج خادم TURN، فأضفه في `NEXUS_TURN_SERVERS` (PART 14). البث الواسع يحتاج مزوّد بث (SFU/CDN). Firestore يحمل الإشارات والدردشة فقط، ولا يمر فيه أي فيديو.
- **مفاتيح AI** يدخلها كل مستخدم وتُحفظ في متصفحه فقط، فلا تُكتب في Firestore ولا في الكود. لتقديم AI لكل الزوار بمفتاحك أنت، استخدم وسيطًا (proxy) على خادمك وضعه كمزوّد «مخصّص».
- **C / C++ / C#** تحتاج حزمة مترجم يضعها المالك في Toolchains. بدونها يفشل البناء بعبارة «Compiler unavailable» ولا يدّعي النجاح.
