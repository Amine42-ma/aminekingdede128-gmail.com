# Architecture

```
                 ┌──────────────┐
  your projects →│   Importer   │→ copies into <workspace>/imports  (originals untouched)
                 └──────┬───────┘
                        ↓
                 ┌──────────────┐   JS tokenizer · HTML · CSS · GLB binary · PNG decoder
                 │   Analyzer   │→  49 concept detectors · role/relation graph
                 └──────┬───────┘
                        ↓
        ┌───────────────┴────────────────┐
        ↓                                ↓
 ┌─────────────┐                 ┌──────────────┐
 │  Knowledge  │  concepts,      │   Project    │  one project's architecture,
 │  (global)   │  confidence,    │   Memory     │  bugs, decisions, versions
 │  + Graph    │  parameters     └──────────────┘
 └──────┬──────┘
        ↓
 ┌─────────────┐  trait space (73M combinations) · novelty search · diversity rejection
 │  Designer   │→ design document: concept → loop → goal → controls → progression →
 └──────┬──────┘  difficulty → world → UI → architecture → implementation plan
        ↓
 ┌─────────────┐  engine emitters (core, math, input, entities, physics, collision,
 │  Generator  │  camera, ai, procgen, particles, render, ui, audio, save, three)
 └──────┬──────┘  + 8 gameplay rulesets + assembly (html/css/config/manifest/readme)
        ↓
 ┌─────────────┐  node:vm + DOM/canvas stub + virtual clock
 │   Sandbox   │  no require, no process, no network
 └──────┬──────┘
        ↓
 ┌─────────────┐  16 checks with numeric evidence
 │ Test Agent  │→ verdict: ship | needs-work | broken
 └──────┬──────┘
        ↓ (on failure)
 ┌─────────────┐  map failure → policy/design mutation → re-emit → re-test
 │ AutoDebugger│
 └──────┬──────┘
        ↓
 ┌─────────────┐  fixed 8-task benchmark · experiments · version promote/rollback
 │  Evolution  │→ lessons book feeds back into knowledge confidence
 └─────────────┘
```

## Data flow: where each thing lives

| Store collection | Written by | Read by |
|---|---|---|
| `projects` | Importer, Analyzer | Designer (priors), Diversity (code fingerprints) |
| `knowledge` | Knowledge engine | Designer, Novelty, Generator (module choices) |
| `memory` | Project memory | UI, exports |
| `designs` | Designer | Diversity, Generator, training datasets |
| `generated` | Generator | UI, exports, training datasets |
| `versions` | Version manager | Autopilot, benchmark comparison |
| `experiments` | Experiment engine | Autopilot (avoid re-litigating) |
| `lessons` | Lesson book | Autopilot weakness analysis |
| `tasks` | Task queue | Worker loop, UI |
| `datasets` | Training pipeline | Training engine interface |
| `research` | Research engine | UI, offline report |

## Key design decisions

**Emitted games use classic `<script>` tags and a `LAB` global.**
Not a stylistic choice: it means a generated project runs from `file://` with no
server, no bundler and no import map — and the headless sandbox can load the same
files without an ESM loader.

**The policy is the agent version.**
An "agent version" is the set of generation decisions (loop style, delta clamp,
broadphase, pooling, particle budget, input buffering, difficulty bias). Those
decisions change emitted code, which makes a version difference measurable.

**The test surface is part of the product.**
Every generated game exposes `window.__LAB__` with `press/release/snapshot`. It
changes no behaviour, and it is what turns "generate → test → fix" into a real
loop instead of a claim.

**Determinism everywhere.**
Seeded RNG in the designer, in the emitted game, and a virtual clock in the
sandbox. A failing build can be reproduced exactly from its seed.
