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
| **عدّة لغات** | JavaScript · TypeScript · C · C++ · C# · HTML · CSS — كلٌّ بطريقته الصحيحة، و`native` إلى WebAssembly لا إلى JavaScript |
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

## اللغات والبناء

المنصة ليست محرّر كود فقط: فيها **Build Manager** حقيقي يكتشف لغات المشروع،
يشغّل المحوّل المناسب لكل لغة، ثم يُنتج Build يعمل داخل Browser Runtime.

```
Source → Language Detector → Language Adapter → Compiler/Transpiler/Runtime
       → Browser-Compatible Build → Engine Bridge → Browser Game Runtime
```

| اللغة | الطريقة الصحيحة | الحالة |
|---|---|---|
| **JavaScript** | تشغيل مباشر في Browser Runtime | يعمل فورًا |
| **TypeScript** | TS → JS بمترجم `tsc` الرسمي داخل Web Worker | يعمل بعد تثبيت المترجم من Toolchains (‎~9 MB‎، يُخزَّن للعمل دون اتصال) |
| **HTML** | طبقة واجهة حقيقية فوق مساحة اللعب | يعمل فورًا |
| **CSS** | يُقصر تلقائيًا على طبقة اللعبة | يعمل فورًا |
| **C** | C → **WebAssembly** → Engine Bridge | يحتاج سلسلة أدوات WASI، أو ملف ‎`.wasm`‎ مترجَم مسبقًا |
| **C++** | C++ → **WebAssembly** → Engine Bridge | يحتاج سلسلة أدوات WASI، أو ملف ‎`.wasm`‎ مترجَم مسبقًا |
| **C#** | C# → **WebAssembly / .NET** → Engine Bridge | يحتاج وقت تشغيل .NET WASM، أو ملف ‎`.wasm`‎ من ‎`dotnet publish`‎ |

### لا ترجمة وهمية

زر **BUILD** مربوط بمنطق حقيقي فقط:

* TypeScript يُترجَم بمترجم Microsoft الفعلي — الأنواع تُحذف فعلًا،
  و**فحص الأنواع حقيقي** ويعرف واجهة المحرك (`nexus.engine.d.ts` مضمّن)،
  فاستدعاء مثل `Player.moveWithInput("fast")` يفشل البناء برسالة المترجم نفسها.
* إذا لم تكن سلسلة الأدوات مثبّتة، يفشل البناء برسالة **Compiler unavailable**
  تشرح اللغة والأداة المطلوبة — ولا يُنتَج Build أبدًا.
* حالة **READY** في Toolchains لا تظهر إلا بعد تنزيل المترجم والتحقق منه
  بترجمة اختبارية فعلية.
* لا يُستخدم أي API خارجي للترجمة إلا إذا وضعت رابطه بنفسك.

### C / C++ / C# اليوم

مسار **‎`.wasm`‎ المترجَم مسبقًا يعمل بالكامل الآن**: ترجم محليًا ثم
أضف الناتج إلى المشروع من «ملفات المشروع ← استيراد .wasm».

```bash
clang++ --target=wasm32 -O2 -fno-exceptions -fno-rtti -nostdlib \
  -Wl,--no-entry -Wl,--export-dynamic main.cpp -o game.wasm
```

يستورد المحرك الوحدة، ويربطها بـ Engine Bridge، ويستدعي `start()` ثم
`update(float dt)` كل إطار. ملف `engine.h` يُضاف تلقائيًا لمشاريع C/C++
وفيه تصريحات كل دوال الجسر.

للترجمة **داخل المتصفح** ضع رابط حزمة تطابق عقد Toolchain Provider:

```js
export default {
  name: "my-clang-wasi", version: "1.0.0",
  async init({ onProgress }) { /* … */ },
  async compile({ lang, files, options }) {
    return { ok: true, wasm: new Uint8Array(/* … */),
             diagnostics: [{ severity:"error", file:"main.c", line:12, column:5, message:"…" }],
             log: [] };
  }
};
```

أي مترجم يطابق هذا العقد يصبح جزءًا من المنصة — وهكذا تُضاف لغات جديدة
بـ Language Adapter واحد دون تغيير بقية النظام.

### Engine Bridge

واجهة واحدة لكل اللغات: `Engine · Scene · Object · Transform · Camera ·
Input · Physics · Audio · UI · Player · Events · Time · Assets · Storage`.

وحدة WASM لا ترى شيئًا سوى هذه الدوال: لا DOM، لا شبكة، لا تخزين إلا بإذن.
وإذا طلبت الوحدة استيرادًا غير موجود، تُذكر الدالة بالاسم بدل رسالة غامضة.

```c
#include "engine.h"
static obj_t player;

EXPORT(start) void start(void) {
  E_LOG("C++ module started");
  obj_t ground = engine_scene_create("plane", 5, 0,0,0, 40,1,40, 0x2a3050);
  E_BODY(ground, "static");
  player = engine_scene_create("box", 3, 0,3,0, 1,1,1, 0x7c5cff);
  E_BODY(player, "character");
  engine_camera_follow(player, 0, 4, 8);
}

EXPORT(update) void update(float dt) {
  engine_physics_set_velocity(player,
    E_AXIS("horizontal") * 6.0f, engine_physics_get_vel_y(player), E_AXIS("vertical") * 6.0f);
  if (E_BTN("jump") && engine_physics_grounded(player)) E_EMIT("Jumped", 1.0f);
}
```

### HTML و CSS داخل اللعبة

HTML يصنع الواجهة، ولا يُنفَّذ منه أي سكربت: الربط بالمحرك تصريحي.

```html
<div class="hud">النقاط <span data-bind="score">0</span></div>
<button data-emit="Buy" data-value="speed">شراء</button>
<input data-field="playerName" />
```

```js
Events.on("Buy", what => { /* … */ UI.bind("score", score); });
const name = UI.value("playerName");
```

وكل CSS تكتبه يُقصر تلقائيًا على `#game-ui-layer` فلا يؤثر على المحرر حوله.

### مشروع متعدّد اللغات

```
Main.js · Hud.ts · main.cpp · engine.h · Game.cs · ui.html · style.css · game.wasm
```

كلها في قائمة ملفات واحدة، ولكل ملف: لغته، ودوره (سكربت / مكوّن / واجهة /
نمط / وحدة)، وإمكانية ربطه بكائن في المشهد. والنواتج تُخزَّن بـ Hash للمصدر
فلا يُعاد بناء ما لم يتغيّر — وهذا ما يجعل البناء على الهاتف سريعًا.

### الأخطاء

كل خطأ يظهر بملفه وسطره وعموده ولغته في لوحة **Problems**، والضغط عليه
ينقلك إلى السطر مباشرة.

---

## عرض المحرر

الشبكة ومؤشرات الإضاءة والكاميرا ونقطة الظهور وعدّاد الأداء كلها **عناصر
محرر فقط** ولا تظهر في اللعبة المنشورة. من زر العرض في مساحة العمل يمكنك
إطفاء أي منها، أو «إخفاء كل عناصر المحرر» لمشهد نظيف فيه مجسماتك وحدها،
والاختيار يُحفظ.

ولتحريك أي شيء: المس المجسم واسحبه مباشرة — لا حاجة لتحديده أولًا.

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

`index.html` مقسّم إلى عشرة أجزاء متسلسلة قابلة للدمج مباشرة:

| الجزء | المحتوى |
|---|---|
| **PART 1/10** | الترويسة، import map، نظام التصميم (mobile-first، safe-area، 100dvh) |
| **PART 2/10** | هيكل الصفحة وطقم الواجهة (i18n، Sheets، Modals، Toasts) |
| **PART 3/10** | طبقة البيانات: Firebase (Auth/Firestore/Storage) + بديل محلي معلن + قواعد الأمان |
| **PART 4/10** | نواة المحرك: العارض، شجرة الكائنات، المحمّلات والذاكرة، لمس التحرير، الفيزياء |
| **PART 5/10** | Engine API + تشغيل السكربتات في نطاق مقيّد + Mic + Network + Voice + التوثيق |
| **PART 6/10** | خط الأصول: تحليل، صور مصغّرة، معاينة 3D، المكتبة والبحث |
| **PART 7/10** | الاستوديو: الشجرة، الخصائص، العالم، مساعد AI، التشغيل والنشر |
| **PART 9/10** | نظام البناء: Toolchain Manager، Language Adapters، Build Manager، Compiler Cache، Engine Bridge (WASM) |
| **PART 10/10** | بيئة التطوير متعدّدة اللغات: الملفات، التبويبات، BUILD/RUN/STOP، Problems، Toolchains |
| **PART 8/10** | المنصة: الألعاب، استكشاف، إنشاء، ألعابي، الأصول، الحساب + المشغّل + الإقلاع |

المتصفح: Chrome/Edge/Safari حديث مع WebGL2.
Three.js يُحمَّل من CDN عبر `importmap` — عند تعذّر التحميل تظهر رسالة صريحة بدل شاشة فارغة.
