# صوتك · Sawtak — استوديو الدبلجة الذكي

تطبيق من **ملف HTML واحد** يحوّل **صوت** الفيلم من الفرنسية أو الإنجليزية (أو أي لغة أخرى) إلى اللغة التي تريدها —
دبلجة صوتية حقيقية بأصوات بشرية، **وليست ترجمة نصية**. كل المعالجة تجري داخل متصفحك؛ الفيلم لا يُرفع إلى أي خادم.

---

## كيف يعمل

```
الفيلم ──▶ استخراج المسار الصوتي ──▶ تفريغ الحوار (Whisper) ──▶ ترجمة ──▶ نطق بصوت بشري ──▶ مزج مع الفيلم
```

عند التشغيل يُخفَض صوت الممثلين تلقائياً وقت الحوار فقط، ويحلّ الصوت الجديد مكانه، بينما تبقى **الموسيقى والمؤثرات** كما هي.

## طريقة التشغيل

المتصفح يمنع تحميل نماذج الذكاء الاصطناعي من `file://`، لذا شغّل الملف عبر خادم محلي بسيط:

```bash
python3 -m http.server 8000
# ثم افتح: http://localhost:8000/index.html
```

أو:

```bash
npx serve .
```

**المتصفح المطلوب:** Chrome أو Edge (نسخة حديثة). وجود **WebGPU** يجعل المعالجة أسرع بعدة أضعاف، وبدونه يعمل التطبيق على WASM.

## الخطوات

1. **حمّل الفيلم** — اسحب الملف إلى المشغّل، أو اضغط «اختيار ملف»، أو الصق رابطاً مباشراً للملف.
2. **اختر اللغات** — «كشف تلقائي» يتعرّف على لغة الفيلم بنفسه، ثم اختر اللغة التي تريد سماع الفيلم بها.
3. **اضغط «ابدأ الدبلجة»** — تتابع الخطوات الخمس أمامك مع نسبة التقدّم.
4. **شغّل الفيلم** — واستمتع. يمكنك تعديل أي جملة في «سيناريو الدبلجة» مباشرةً بالكتابة فوقها.

## الأصوات: أيّ محرّك تختار؟

| المحرّك | الجودة | يحتاج إنترنت | تصدير WAV |
|---|---|---|---|
| **أصوات المتصفح** (افتراضي) | جيدة، تعتمد على نظامك | لا | لا |
| **ElevenLabs** | بشرية بالكامل، +٣٠ لغة | مفتاح API | نعم |
| **OpenAI متوافق** | عصبية طبيعية | مفتاح API | نعم |

للحصول على إحساس «الفيلم المدبلج» الحقيقي بلا نبرة آلية، استخدم **ElevenLabs** مع `eleven_multilingual_v2`.
إن بقيت على أصوات المتصفح، ثبّت حزمة الصوت العربي في نظامك (ويندوز: الإعدادات ← الوقت واللغة ← الصوت) لفرق كبير في الجودة.

المفتاح يُحفظ في `sessionStorage` داخل متصفحك فقط، ويُمسح بإغلاق التبويب، ولا يُرسل إلا للخدمة التي اخترتها.

## ما الذي يجعل الصوت غير آليّ

- **تعدّد الأصوات**: يبدّل الصوت عند تغيّر المتحدث حسب فواصل الصمت ونهايات الجمل.
- **أداء بشري**: تنويع طفيف في النبرة والسرعة لكل جملة، وتقسيمها عند علامات الترقيم لوقفات طبيعية.
- **مطابقة زمن المشهد**: ضبط سرعة كل جملة لتنتهي مع انتهاء كلام الممثل.
- **مزج ذكي**: خفض تدريجي (Ducking) لصوت الفيلم أثناء الحوار فقط، مع بقاء الموسيقى.

## اللغات المدعومة

٣١ لغة للترجمة والنطق: العربية، الإنجليزية، الفرنسية، الإسبانية، الألمانية، الإيطالية، البرتغالية، الروسية، التركية،
الهولندية، البولندية، السويدية، الإندونيسية، الهندية، الأردية، الفارسية، العبرية، اليابانية، الكورية، الصينية،
اليونانية، الرومانية، الأوكرانية، التشيكية، الدنماركية، الفنلندية، النرويجية، المجرية، التايلاندية، الفيتنامية، الماليزية.

الاتجاه يعمل في كل الاتجاهات: فرنسي ← عربي، عربي ← فرنسي، إنجليزي ← عربي، عربي ← إنجليزي… إلخ.

## النماذج المستخدمة

| المهمة | النموذج | يعمل |
|---|---|---|
| تفريغ الكلام | Whisper (tiny / base / small / large-v3-turbo) | داخل المتصفح |
| الترجمة | NLLB-200 distilled 600M | داخل المتصفح |
| الترجمة (اختياري) | نموذج لغوي عبر API | عبر الشبكة |
| النطق | Web Speech / ElevenLabs / OpenAI | حسب اختيارك |

في أول تشغيل يُنزَّل النموذج مرة واحدة ويُحفظ في ذاكرة المتصفح، ثم يعمل بلا إنترنت بعدها.

## حدود يجب معرفتها

- **روابط يوتيوب وخدمات البثّ غير مدعومة** (حماية CORS وشروط الاستخدام). استخدم ملفاً على جهازك أو رابطاً مباشراً لملف.
- **التصدير صوتي فقط (WAV)** — التطبيق لا يعيد ترميز الفيديو. لدمج الصوت المدبلج مع الفيلم:
  ```bash
  ffmpeg -i film.mp4 -i film.ar.wav -map 0:v -map 1:a -c:v copy -shortest film-ar.mp4
  ```
- بعض الحاويات مثل **MKV/AVI** قد لا يفكّها المتصفح مباشرة؛ عندها يلتقط التطبيق الصوت أثناء تشغيل سريع تلقائياً، وهو أبطأ. التحويل إلى MP4 أسرع.
- **تصدير WAV** يعمل مع محرّكات API فقط، لأن أصوات المتصفح لا يمكن تسجيلها برمجياً.
- دقة الدبلجة تتبع دقة التفريغ: للأفلام ذات الموسيقى العالية اختر نموذجاً أكبر (`small` أو `large-v3-turbo`).

## اختصارات لوحة المفاتيح

`مسافة` تشغيل/إيقاف · `→` `←` تنقّل ١٠ ثوانٍ · `D` تشغيل/إيقاف الدبلجة

---

<details>
<summary><b>English summary</b></summary>

**Sawtak** is a single-file HTML app that re-voices a film into any language you choose — real audio dubbing, not
subtitles. It extracts the audio, transcribes it with Whisper, translates it (NLLB-200 locally, or an LLM via API),
then speaks it back with a human-sounding voice while ducking the original dialogue and keeping music and effects.

Run it from a local server (`python3 -m http.server 8000`) — browsers block model loading over `file://`.
Everything runs on your device; nothing is uploaded. Browser voices are free and offline; ElevenLabs or an
OpenAI-compatible endpoint gives fully human voices and unlocks WAV export of the dubbed track.

</details>

---

# 🦖 بريما · PRIMA — عصر البداية

في هذا المستودع أيضاً **لعبة بقاء ثلاثية الأبعاد كاملة داخل ملف واحد**: `ark.html`.

جزيرة مولّدة عشوائياً، ٢٣ نوعاً من الديناصورات تُصطاد وتُخدَّر وتُروَّض وتُركَب وتتكاثر،
بناء قواعد، كهوف، ثلاثة مسلات وزعيم في النهاية — كل ذلك بلا أي ملف خارجي:
النماذج والصور والأصوات كلها تُولَّد داخل المتصفح لحظة التشغيل.

## التشغيل

```bash
python3 -m http.server 8000
# ثم افتح: http://localhost:8000/ark.html
```

يعمل الملف أيضاً بفتحه مباشرة من القرص، لأنه لا يحمّل أي شيء من الشبكة.

**المتصفح المطلوب:** أي متصفح حديث يدعم WebGL. اللعبة تكتشف قوة جهازك تلقائياً وتختار
مستوى الرسوميات المناسب، ويمكنك تغييره يدوياً من الإعدادات.

## على الهاتف

اللعبة تتعرّف على شاشة اللمس تلقائياً وتعرض أزرار تحكم مصمّمة للهاتف: عصا حركة على اليسار،
نظر حر على اليمين، وأزرار الأفعال على شكل حلقة، مصمّمة على غرار ألعاب البقاء على الهاتف.

## اختبار سريع

```bash
node scripts/smoke.mjs      # اللعبة كاملة: عالم، كل الأنواع، الحفظ
node scripts/touch.mjs      # تحكّم الهاتف: إحساس العصا والنظر، وتخطيط الأزرار
node scripts/gameplay.mjs   # اتجاه مشي الحيوانات، واحتساب الضربة داخل قطيع
node scripts/aquatic.mjs    # حيوانات البحر لا تخرج إلى الشاطئ ولا تلاحقك عليه
node scripts/survival.mjs   # زمن الجوع والعطش، وأثر الصعوبة على ما يظهر في الشاطئ
node scripts/feedback.mjs   # صوت الضربة، والفرق بين الإصابة والضربة في الفراغ
node scripts/legible.mjs    # دقّة الصورة والمدى والضباب ومؤشرات الإعدادات
node scripts/brand.mjs      # اسم اللعبة وشعارها وموسيقى الواجهة
node scripts/playtest.mjs   # اتجاه العصا، بقع الأوراق السوداء، وأسماء الديناصورات
```

الأول يشغّل اللعبة في متصفح بلا واجهة، يولّد عالماً، يستدعي نوعاً من كل الديناصورات،
يشغّل المحاكاة، ثم يتحقق من عدم وجود أخطاء أو قيم فاسدة وأن الحفظ يعمل.
والثاني يتحقق من أن العصا خطّية الاستجابة، وأن دوران الكاميرا لا يتغيّر مع اختلاف
عدد الإطارات، وأن الأزرار لا تتداخل على أي مقاس شاشة.

<details>
<summary><b>English summary</b></summary>

`ark.html` is a complete single-file 3D dinosaur survival game — a procedurally generated island,
23 species to hunt, tranquilise, tame, ride and breed, base building, caves, three obelisks and a
boss fight. There are no external assets at all: every model, texture and sound is generated in the
browser at load time.

Serve it (`python3 -m http.server 8000` → `http://localhost:8000/ark.html`) or just open the file —
it never touches the network. It detects your device and picks a graphics tier automatically, and
switches to a phone control layer — floating stick, free look, a ring of action buttons.

`node scripts/smoke.mjs` runs it headlessly: generate a world, spawn every species, simulate, and
check for console errors, NaN transforms and a working save. `node scripts/touch.mjs` checks the phone
controls: that stick output is linear, that camera rotation per unit of finger travel is independent of
frame rate and pointer-event rate, and that no two controls overlap at any landscape size.

</details>
