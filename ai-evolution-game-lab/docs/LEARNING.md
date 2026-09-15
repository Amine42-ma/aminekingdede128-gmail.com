# ما معنى "يتعلّم" في هذا المشروع · What "learning" means here

هذه الوثيقة موجودة لأن كلمة "تعلّم" تُستعمل لوصف أشياء مختلفة تماماً. كل صف هنا
له تنفيذ حقيقي في الكود، أو تصريح واضح بأنه غير منفَّذ.

This document exists because the word "learning" is used for very different
things. Every row is either implemented in code or explicitly declared as not.

| النوع | منفَّذ؟ | يغيّر أوزان نموذج؟ | أين في الكود |
|---|---|---|---|
| **Knowledge learning** — مفاهيم مجرّدة، نطاقات معاملات، رسم معرفي | ✅ | ❌ | `src/knowledge/engine.js`, `graph.js` |
| **Memory learning** — ذاكرة مشروع منفصلة عن المعرفة العامة | ✅ | ❌ | `src/knowledge/memory.js` |
| **Workflow learning** — سياسات الوكيل تُرقّى أو تُرجَع بقياس | ✅ | ❌ | `src/evolution/versions.js` |
| **Retrieval** — استرجاع معجمي فوق المعرفة المخزّنة | ✅ | ❌ | `src/models/provider.js` (`HeuristicProvider.embed`) |
| **Fine-tuning** | ⚠️ واجهة فقط | ✅ (لو توفرت خلفية) | `src/training/pipeline.js` (`TrainingEngine`) |
| **Continued training** | ⚠️ واجهة فقط | ✅ (لو توفرت خلفية) | نفس الملف |

## الفرق العملي

**تحسين الوكيل (Agent Improvement)** — منفَّذ ومقيس:
يغيّر الأدوات والذاكرة وسير العمل والمعرفة والكود المولَّد. يمكن قياسه على benchmark ثابت،
ويمكن التراجع عنه. لا علاقة له بأوزان أي نموذج.

**تدريب النموذج (Model Training)** — غير منفَّذ:
يغيّر أوزاناً عبر بيانات وتدريب وGPU. هذا المشروع **يجهّز البيانات فقط**:
`build → clean → dedupe → prepare → save (JSONL)`، ثم يتوقف عند الحد ويقول:

> *"No training backend is attached. Fine-tuning needs a GPU service; this process cannot change model weights."*

## قواعد اللغة التي يلتزم بها النظام

1. لا يُقال "أصبح أذكى". يُقال: `+X.XX نقطة على benchmark من N مهمة`.
2. لا يُعلن تحسّن إذا كان الفرق **داخل هامش الضجيج** — يُسجَّل `inconclusive`.
3. إذا تغيّرت قاعدة المعرفة بين قياسين، يُرفق تحذير بأن جزءاً من الفرق قد يعود إلى
   المعرفة لا إلى السياسة (بصمة المعرفة مسجَّلة مع كل قياس).
4. الثقة في أي مفهوم لا تتجاوز `0.9` بالتكرار وحده؛ تحتاج نجاحاً فعلياً في توليد
   كود عامل أو تحققاً من مصدر خارجي.
5. بدون نموذج رؤية مُهيّأ، تحليل الصور يُوصف بأنه **بنيوي** لا دلالي — والناتج نفسه
   يحمل هذا التصريح في حقل `note`.

## كيف تتحقق بنفسك

```bash
node --test test/pipeline.test.js   # الثقة، التنوّع، الترقية بالقياس
node --test test/subsystems.test.js # حدود التدريب، عزل الصندوق، صدق المزوّدين
node bin/lab.js benchmark           # الرقم نفسه في كل مرة لنفس السياسة
node bin/lab.js evolve --cycles 3   # ويقول بوضوح إن لم يتحسن شيء
```
