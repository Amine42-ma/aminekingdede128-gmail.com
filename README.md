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

# 🦖 ARK · Survival Reborn — `ark.html`

لعبة بقاء ثلاثية الأبعاد بمنظور أول على غرار **ARK: Survival Evolved**، داخل **ملف HTML واحد** يعمل
**بلا إنترنت**: جزيرة مولَّدة إجرائياً، ١٣ نوعاً من الديناصورات بحركة إجرائية حقيقية، ضرب باليد،
أسهم تخدير وشريط Torpor، ترويض كامل بالإطعام، ركوب بالسروج، جمع موارد وتصنيع وبناء بالتثبيت الشبكي،
دورة ليل/نهار وطقس، وحفظ تلقائي. لا يحتاج أي ملف خارجي ولا خادماً: **افتح `ark.html` بالمتصفح مباشرة**.

> واجهة اللعبة بالإنجليزية. مكتبة three.js مدمجة داخل الملف (رخصة MIT).

## Play

Open `ark.html` in a recent Chrome, Edge, Firefox or Safari — double-click is enough, no server, no network.
Click the canvas to lock the mouse. Everything you see (terrain, creatures, textures, icons, sounds) is
generated at runtime.

## The loop

Punch a tree for **Thatch** → gather Wood, Stone, Flint and Fiber → learn engrams (`C`) and craft a
**Stone Pick** → hunt with a **Spear** → make **Narcotic** in a Mortar & Pestle → craft a **Bow** and
**Tranquilizer Arrows** → fill a creature's purple **Torpidity** bar until it drops → put the right food in
its inventory and watch **Taming Effectiveness** decide your **bonus levels** → craft a saddle and ride it →
build a base, tame something bigger.

## Controls

| | |
|---|---|
| `W A S D` · `Shift` · `Ctrl` · `Space` | move · sprint · crouch · jump |
| `Left click` / `Right click` | attack, harvest, fire · aim (bow), throw (spear) |
| `E` · `F` | interact / ride · creature inventory |
| `I` · `C` · `M` · `B` | inventory · character & engrams · map · build mode |
| `1…0` · mouse wheel | hotbar |
| `J` · `U` · `T` · `Y` | whistle: follow · stop · attack target · passive |
| `V` · `H` · `Esc` | camera · controls help · pause |

## What is simulated

- **Taming, ARK-style.** Torpidity rises from tranq hits (headshots count double) and drains over time by
  level; an unconscious creature eats from its own inventory, its food drains, narcotics keep it under, and
  if torpor reaches zero it **wakes up and all progress is lost**. Affinity per food, effectiveness loss per
  food, `bonus levels = level × 0.5 × effectiveness`, kibble tiers, and passive tames (Ichthyosaurus).
- **13 species** — Dodo, Parasaur, Trike, Stego, Raptor, Dilophosaur, Carno, Rex, Pteranodon, Ankylosaurus,
  Doedicurus, Sarcosuchus, Ichthyosaurus, Megalodon — each with its own anatomy, gait, AI, diet, harvest
  bonus and saddle level. Raptors hunt in packs, herbivores flee, a Rex will chase you across the island.
- **Survival:** health, stamina, oxygen, food, water, weight, torpidity, temperature, food poisoning,
  drowning, fall damage, XP and stat points, engram tree, death with a lootable corpse bag.
- **Building:** thatch/wood/stone tiers with snapping, doors and gateways that really block creatures —
  four gateways make a working dino trap.
- **World:** seeded 2 km island with seven biomes, chunked terrain LOD, instanced foliage, animated ocean
  with shoreline foam, day/night, rain, fog and thunderstorms, timed supply drops.
- **Saves:** three slots in `localStorage` plus autosave, and JSON export.

## Settings

Quality presets (Low → Ultra), shadows, bloom, FOV, sensitivity, key rebinding, and gameplay rates —
taming speed, harvest amount, XP, day length and creature population — from the main menu or `Esc → Settings`.
