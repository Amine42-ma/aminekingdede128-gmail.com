# NEXUS — محرك ألعاب فارغ · Empty Core Engine

> **THE ENGINE PROVIDES THE TOOLS. THE USER CREATES THE GAME.**

محرك ألعاب ثلاثي الأبعاد يعمل في المتصفح، **من ملف `index.html` واحد**.
لا يأتي بمكتبة مجسمات جاهزة ولا بألعاب قوالب: المشروع الجديد يبدأ بعالم فارغ،
والمستخدمون هم من يبنون مكتبة الأصول، والبرمجة هي الأساس.

```
EMPTY CORE ENGINE + USER CODE + USER ASSETS + PUBLIC ASSET LIBRARY
                  + AI ASSISTANT + FIREBASE + GAME PLATFORM
```

---

## الفلسفة

| المبدأ | التطبيق |
|---|---|
| **محرك فارغ** | المشروع الجديد يحتوي فقط: `Scene` · `Camera` · `Light` · `Spawn Point` — بالإضافة إلى أشكال أولية تقنية (Box/Sphere/Plane/Cylinder/Cone) كأدوات بناء، لا كمكتبة محتوى |
| **المستخدم مصدر الأصول** | يرفع ملفاته ويختار `PUBLIC` أو `PRIVATE` |
| **مكتبة عامة مشتركة** | ما يُرفع كـ Public يظهر لكل المستخدمين مع بقاء اسم المنشئ |
| **بحث حقيقي** | النتائج تأتي من Firestore/التخزين المحلي — لا نتائج وهمية ولا شعبية مخترعة |
| **مرجع لا نسخة** | المشهد يخزّن `assetId` فقط؛ الملف لا يُنسخ لكل لعبة |
| **الكود هو الأساس** | لم تجد `Vehicle Controller`؟ اكتبه. `Quest System`؟ اكتبه |
| **الـAI مساعد** | يقترح كودًا تراه وتعدّله وتحذفه — وليس بديلًا عن نظام السكربت |
| **الهاتف أولًا** | استوديو مصمّم للهاتف، وليس نسخة مصغّرة من سطح المكتب |

---

## التشغيل

المتصفح يمنع وحدات ES من `file://`، لذا شغّله عبر خادم محلي:

```bash
python3 -m http.server 8000     # ثم افتح http://localhost:8000/index.html
# أو
npx http-server -p 8000
```

يعمل فورًا في **وضع محلي (LOCAL MODE)**: الأصول والمشاريع والألعاب تُحفظ في
IndexedDB داخل متصفحك. لا بيانات وهمية — تخزين حقيقي، لكنه غير مشترك.

### تفعيل الوضع المتصل (Firebase)

الإعدادات ← Firebase ← الصق الإعدادات ← حفظ وإعادة التشغيل.
أو عدّل `FIREBASE_CONFIG_INLINE` في أعلى **PART 3** داخل `index.html`.

ثم انشر قواعد الأمان الجاهزة من: **الإعدادات ← الأمان وقواعد Firebase**
(زر نسخ لكل من Firestore و Storage). القواعد تفرض على الخادم:

* الأصل يُنشئه صاحبه فقط، ويبدأ بـ `usageCount = 0`
* `usageCount` / `plays` / `likes` لا تتحرك إلا بمقدار `±1` ولا يمكن للعميل إرسال رقم جاهز
* `plays` مرة واحدة لكل (مستخدم، جلسة) · `likes` وثيقة واحدة لكل مستخدم

---

## الاستوديو على الهاتف

الـ**Viewport هو العنصر الأكبر دائمًا** (نحو ٨٦٪ من ارتفاع الشاشة عموديًا،
ونحو ٧١٪ أفقيًا). كل لوحة تظهر كـ Bottom Sheet مؤقتة وتختفي عند إغلاقها.

```
┌─────────────────────────┐
│ ☰   My Game      ▶  ⋮  │   ← شريط علوي مع safe-area
├─────────────────────────┤
│                         │
│      3D VIEWPORT        │   ← 100dvh، لمس كامل
│                         │
│   [Box] ⊹ ⟳ ⤢ ⚙        │   ← شريط التحديد (يظهر عند اختيار كائن)
├─────────────────────────┤
│ المشهد │ الأصول │ الكود │
│ العالم │ الذكاء │ المزيد│
└─────────────────────────┘
```

**اللمس:** نقرة = تحديد · سحب = تحريك · إصبعان = الكاميرا · قرص = تكبير.
مع أزرار `Move` / `Rotate` / `Scale` عند التحديد.

---

## رفع الأصول

الصيغ المدعومة: `.glb` `.gltf` `.obj` `.fbx*` · `.png` `.jpg` `.webp` ·
`.mp3` `.wav` `.ogg` · `.json` `.txt`
<sub>* FBX يعمل عند توفر المحمّل؛ وإلا يقترح المحرك التحويل إلى GLB.</sub>

عند الرفع يقرأ المحرك الملف **فعليًا** ويستخرج:
`Meshes · Materials · Textures · Triangles · Vertices · Animations · Skeleton · Bones · Bounding Box`
ويولّد **صورة مصغّرة من المجسم نفسه** عبر Three.js (وموجة صوتية حقيقية للملفات الصوتية).

ثم: معاينة ثلاثية الأبعاد → الاسم، الوصف، الفئة، الوسوم، الترخيص، الظهور → `UPLOAD`.

`Public` تعني: متاح داخل مكتبة المنصة وفق شروطها — **ولا تعني تنازلك عن حقوقك**.
الترخيص يبقى ظاهرًا: `Original · CC0 · CC BY · Licensed · Other`.

---

## البحث

يفهرس البحث الاسم والوسوم والفئة واسم المنشئ (مع بادئات جزئية ومعالجة للحروف العربية).
ترتيب: `Relevance` · `Newest` · `Most Used` — والشعبية من `usageCount` الحقيقي فقط.

```
"car"     → Sports Car, Police Car …      "vehicle" → أي أصل موسوم vehicle
"tree"    → الأشجار المرفوعة               "house"   → لا نتائج إن لم يرفع أحد شيئًا
```

---

## Engine API

متاحة داخل كل سكربت، وموثّقة في **Developer / API panel** داخل الاستوديو:

`Engine` `Scene` `Object (self)` `Player` `Input` `Physics` `Audio` `Camera`
`UI` `Network` `Voice` `Events` `Assets` `Save` `Time` `Mic`

```js
async function start() {
  const ground = await Scene.create({ type: "primitive", props: { shape: "plane" }, scale: [40, 1, 40] });
  ground.addBody({ type: "static" });            // بدون جسم ثابت يسقط اللاعب
  const hero = await Player.create({ speed: 6.5, position: [0, 2, 0] });
  UI.joystick({ side: "left" });
  Camera.follow(hero, { offset: [0, 4, 8] });
  Events.on("Scored", n => Engine.log("score " + n));
}

function update(dt) {
  Player.moveWithInput();
  if (Input.button("jump")) Player.jump();
}
```

دورة الحياة: `start()` → `update(dt)` كل إطار → `destroy()`.
و`self` هو الكائن المرتبط بالسكربت. وتستطيع إنشاء **مكوّنات** و**أحداث** خاصة بك:

```js
Events.emit("RaceFinished", { time: 42.1 });
Events.emit("PlayerEnteredShop");
```

### الميكروفون والصوت بين اللاعبين

`Mic.request / start / stop / mute / unmute / pushToTalk / level / onLevel / startRecording / outputStream`

الصوت الجماعي مبني على `Network.signal()` + WebRTC ويحتاج **Signaling backend**
(أي Firebase مضبوطة)، وقد يحتاج خادم TURN في بعض الشبكات. المحرك لا يدّعي غير ذلك.

---

## الأمان

* **الأصول ≠ الكود.** الأصول بيانات فقط ولا تُنفَّذ أبدًا، ولا تُقبل ملفات سكربت كأصول.
* كود اللعبة يخص المشروع لا الأصل، ويعمل في نطاق لا يرى
  `window` · `document` · `fetch` · `localStorage` · `XMLHttpRequest` · … (تبقى `Object`/`JSON`/`Math` متاحة لأن الكود يحتاجها).
* **كود مطوّر آخر لا يعمل إلا بموافقتك الصريحة**، ويمكنك قراءته كاملًا قبل التشغيل.
* التقييد داخل الصفحة حاجز سلامة لا حاجز أمني مطلق — ولهذا توجد بوابة الموافقة.

---

## الأداء

تحميل كسول للصور المصغّرة (IntersectionObserver) · ترقيم صفحات بمؤشرات Firestore ·
ذاكرة أصول مشتركة بتحميل واحد لكل جلسة · استنساخ يشارك الـgeometry/material ·
`InstancedMesh` · `LOD` · Frustum Culling · تنظيف الموارد عند الحذف.

---

## بنية الملف

`index.html` مقسّم إلى ثمانية أجزاء متسلسلة قابلة للدمج مباشرة:

| الجزء | المحتوى |
|---|---|
| **PART 1/8** | الترويسة، import map، نظام التصميم (mobile-first، safe-area، 100dvh) |
| **PART 2/8** | هيكل الصفحة وطقم الواجهة (i18n، Sheets، Modals، Toasts) |
| **PART 3/8** | طبقة البيانات: Firebase (Auth/Firestore/Storage) + بديل محلي معلن + قواعد الأمان |
| **PART 4/8** | نواة المحرك: العارض، شجرة الكائنات، المحمّلات والذاكرة، لمس التحرير، الفيزياء |
| **PART 5/8** | Engine API + تشغيل السكربتات في نطاق مقيّد + Mic + Network + Voice + التوثيق |
| **PART 6/8** | خط الأصول: تحليل، صور مصغّرة، معاينة 3D، المكتبة والبحث |
| **PART 7/8** | الاستوديو: الشجرة، الخصائص، محرر الكود، العالم، مساعد AI، التشغيل والنشر |
| **PART 8/8** | المنصة: الألعاب، استكشاف، إنشاء، ألعابي، الأصول، الحساب + المشغّل + الإقلاع |

المتصفح: Chrome/Edge/Safari حديث مع WebGL2.
Three.js يُحمَّل من CDN عبر `importmap` — عند تعذّر التحميل تظهر رسالة صريحة بدل شاشة فارغة.
