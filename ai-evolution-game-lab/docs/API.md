# HTTP API

`node bin/lab.js serve` binds `127.0.0.1:7717` by default. The API is
unauthenticated because it is a local single-user tool; binding to another
interface logs a warning.

## Read

| Route | Returns |
|---|---|
| `GET /api/status` | counts, agent version, capabilities, disclaimer |
| `GET /api/config` | workspace, permissions, limits, research allowlist |
| `GET /api/projects` | imported projects with analysis summaries |
| `GET /api/projects/:id` | full analysis + project memory |
| `GET /api/knowledge` | knowledge items grouped by category + stats |
| `GET /api/knowledge/graph` | PMI-weighted nodes and edges |
| `GET /api/designs` | design documents |
| `GET /api/generated` | generated projects with test results |
| `GET /api/generated/:id` | one project plus its design document |
| `GET /api/versions` | agent version history with benchmarks |
| `GET /api/versions/compare?a=v1&b=v2` | per-task deltas and policy diff |
| `GET /api/experiments` | hypotheses, control/variant scores, conclusions |
| `GET /api/lessons` | recent + recurring lessons |
| `GET /api/queue` | queue state and task list |
| `GET /api/models` | providers and honest capability flags |
| `GET /api/research` | history, online state, offline capabilities |
| `GET /api/training` | datasets, training-engine availability, model versions |
| `GET /api/autopilot` | autonomous mode state and cycle history |
| `GET /api/events?n=200` | recent event log |
| `GET /events` | Server-Sent Events stream (live) |
| `GET /play/:generatedId/...` | serves a generated game so it can be played |

## Write

| Route | Body | Effect |
|---|---|---|
| `POST /api/import` | `{path, options?, queue?}` | import a folder or ZIP |
| `POST /api/analyze` | `{projectId?, reanalyze?}` | analyse one project or all |
| `POST /api/design` | `{seed?, brief?}` | produce a design document (synchronous) |
| `POST /api/generate` | `{seed?, brief?, maxRounds?}` | queued full generation cycle |
| `POST /api/generate/sync` | same | run it inline and return the result |
| `POST /api/benchmark` | — | benchmark the active version |
| `POST /api/evolve` | `{cycles?, taskCount?}` | autonomous improvement cycles |
| `POST /api/autopilot/{pause,resume,stop}` | — | autonomous mode control |
| `POST /api/queue/{start,pause,resume,stop,clear}` | — | queue control |
| `POST /api/queue/task` | `{type, payload, label?, priority?}` | enqueue anything |
| `POST /api/research` | `{question}` | consult official docs |
| `POST /api/training/dataset` | `{name?, include?}` | build + save a dataset |
| `POST /api/training/train` | `{datasetName, baseModel}` | refuses honestly with no backend |
| `POST /api/versions/rollback` | `{version}` | restore a previous agent version |
| `POST /api/export` | `{what, id?}` | project / knowledge / memory / evaluation / datasets / logs |
| `POST /api/permissions` | permission flags | update permissions (`modifyImports` stays off) |
| `POST /api/workspace/grant` | `{path}` | grant read access to a folder |
| `POST /api/assets/license` | `{id, license, ownedByUser?, note?}` | declare an asset's licence |

## Event stream

```js
const es = new EventSource('/events');
es.onmessage = (e) => console.log(JSON.parse(e.data));
// { seq, at, type, level, ...payload }
// types: import.project, analyze.done, knowledge.ingest, design.created,
//         diversity.reject, generate.done, debug.fix, debug.pass, test.report,
//         benchmark.done, experiment.done, version.promote, version.rollback,
//         task.start, task.done, autopilot.cycle, ...
```
