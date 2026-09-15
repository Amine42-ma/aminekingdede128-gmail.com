/**
 * MODEL PROVIDER INTERFACE (spec 12, 13, 52).
 *
 * The lab is not tied to one model. Providers declare what they can actually
 * do, and the rest of the system asks before it assumes - so the lab never
 * claims to "understand a sketch" when no vision model is configured, and never
 * claims to have reasoned with an LLM when it ran offline heuristics.
 *
 * Credentials: only from the user's own config/environment. The lab never
 * searches for, scrapes, or reuses anyone else's API keys.
 */

/**
 * @typedef {object} Capabilities
 * @property {boolean} llm      free-form text generation
 * @property {boolean} vision   image understanding
 * @property {boolean} embedding vector embeddings
 * @property {boolean} local    runs on the user's machine
 * @property {boolean} offline  works with no network
 */

export class ModelProvider {
  constructor({ id, label, capabilities, requiresKey = false }) {
    this.id = id;
    this.label = label;
    this.capabilities = { llm: false, vision: false, embedding: false, local: false, offline: false, ...capabilities };
    this.requiresKey = requiresKey;
  }

  /** @returns {Promise<{text:string, provider:string, usedLlm:boolean}>} */
  async complete() { throw new Error(`${this.id} does not support text completion`); }
  /** @returns {Promise<number[]>} */
  async embed() { throw new Error(`${this.id} does not support embeddings`); }
  /** @returns {Promise<object>} */
  async describeImage() { throw new Error(`${this.id} does not support vision`); }
  async health() { return { ok: true, detail: 'no health check implemented' }; }
}

/**
 * Offline default. Produces deterministic, template-driven text from the lab's
 * own structured data - useful, and explicitly NOT an LLM.
 */
export class HeuristicProvider extends ModelProvider {
  constructor() {
    super({
      id: 'heuristic',
      label: 'Built-in heuristics (offline, no LLM)',
      capabilities: { llm: false, vision: false, embedding: true, local: true, offline: true },
    });
  }

  async complete({ task, data }) {
    const text = renderTemplate(task, data);
    return { text, provider: this.id, usedLlm: false, note: 'template-rendered from structured data; no language model was involved' };
  }

  /**
   * Lexical (bag-of-tokens, hashed) embedding. Real and deterministic, but it
   * captures word overlap, not meaning - labelled as such everywhere it is used.
   */
  async embed({ text, dims = 128 }) {
    const vec = new Array(dims).fill(0);
    const tokens = String(text).toLowerCase().match(/[a-z0-9_.-]+/g) || [];
    for (const tok of tokens) {
      let h = 2166136261;
      for (let i = 0; i < tok.length; i++) { h ^= tok.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
      vec[h % dims] += 1;
    }
    const norm = Math.hypot(...vec) || 1;
    return vec.map((v) => v / norm);
  }

  async health() { return { ok: true, detail: 'always available; runs locally with no network' }; }
}

/** OpenAI-compatible HTTP provider: also covers Ollama and LM Studio locally. */
export class OpenAICompatibleProvider extends ModelProvider {
  constructor({ id = 'openai-compatible', label, baseUrl, model, apiKey = null, local = false, vision = false }) {
    super({
      id,
      label: label || `${model} @ ${baseUrl}`,
      capabilities: { llm: true, vision, embedding: true, local, offline: local },
      requiresKey: !local && !apiKey ? true : !!apiKey,
    });
    this.baseUrl = String(baseUrl).replace(/\/$/, '');
    this.model = model;
    this.apiKey = apiKey;
  }

  #headers() {
    const h = { 'content-type': 'application/json' };
    if (this.apiKey) h.authorization = `Bearer ${this.apiKey}`;
    return h;
  }

  async complete({ prompt, system, maxTokens = 900, temperature = 0.7 }) {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.#headers(),
      body: JSON.stringify({
        model: this.model,
        messages: [system ? { role: 'system', content: system } : null, { role: 'user', content: prompt }].filter(Boolean),
        max_tokens: maxTokens,
        temperature,
      }),
    });
    if (!res.ok) throw new Error(`${this.id} returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    return { text: json.choices?.[0]?.message?.content ?? '', provider: this.id, usedLlm: true, model: this.model };
  }

  async embed({ text }) {
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: this.#headers(),
      body: JSON.stringify({ model: this.embeddingModel || this.model, input: text }),
    });
    if (!res.ok) throw new Error(`${this.id} embeddings returned ${res.status}`);
    const json = await res.json();
    return json.data?.[0]?.embedding ?? [];
  }

  async health() {
    try {
      const res = await fetch(`${this.baseUrl}/models`, { headers: this.#headers() });
      return { ok: res.ok, detail: res.ok ? 'reachable' : `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, detail: `unreachable: ${err.message}` };
    }
  }
}

/** Anthropic Messages API provider (user-supplied key only). */
export class AnthropicProvider extends ModelProvider {
  constructor({ model = 'claude-sonnet-4-5', apiKey = null, baseUrl = 'https://api.anthropic.com/v1' }) {
    super({
      id: 'anthropic',
      label: `Anthropic ${model}`,
      capabilities: { llm: true, vision: true, embedding: false, local: false, offline: false },
      requiresKey: true,
    });
    this.model = model;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async complete({ prompt, system, maxTokens = 1200 }) {
    if (!this.apiKey) throw new Error('Anthropic provider needs your own API key (set it in the lab settings or ANTHROPIC_API_KEY).');
    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    const text = (json.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    return { text, provider: this.id, usedLlm: true, model: this.model };
  }
}

export class ModelRegistry {
  constructor({ config, bus }) {
    this.config = config;
    this.bus = bus;
    this.providers = new Map();
    this.register(new HeuristicProvider());
    this.#loadConfigured();
  }

  register(provider) {
    this.providers.set(provider.id, provider);
    return provider;
  }

  #loadConfigured() {
    const cfg = this.config?.models?.providers || {};
    for (const [id, spec] of Object.entries(cfg)) {
      try {
        // Keys come from the user's config or their own environment - never
        // from anywhere else.
        const apiKey = spec.apiKeyEnv ? process.env[spec.apiKeyEnv] : spec.apiKey || null;
        if (spec.kind === 'openai-compatible') {
          this.register(new OpenAICompatibleProvider({ id, label: spec.label, baseUrl: spec.baseUrl, model: spec.model, apiKey, local: !!spec.local, vision: !!spec.vision }));
        } else if (spec.kind === 'anthropic') {
          this.register(new AnthropicProvider({ model: spec.model, apiKey }));
        }
      } catch (err) {
        this.bus?.warn('model.register.failed', { id, error: err.message });
      }
    }
  }

  get(id) { return this.providers.get(id) || this.providers.get('heuristic'); }

  default() { return this.get(this.config?.models?.default || 'heuristic'); }

  list() {
    return [...this.providers.values()].map((p) => ({
      id: p.id,
      label: p.label,
      capabilities: p.capabilities,
      requiresKey: p.requiresKey,
      ready: !p.requiresKey || !!p.apiKey,
    }));
  }

  /** What the lab may honestly claim right now. */
  capabilities() {
    const ready = [...this.providers.values()].filter((p) => !p.requiresKey || !!p.apiKey);
    return {
      llm: ready.some((p) => p.capabilities.llm),
      vision: ready.some((p) => p.capabilities.vision),
      embedding: ready.some((p) => p.capabilities.embedding),
      localOnly: ready.every((p) => p.capabilities.local),
      providers: ready.map((p) => p.id),
      note: ready.some((p) => p.capabilities.vision)
        ? 'A vision-capable provider is configured; image understanding is available.'
        : 'No vision model configured: image input is analysed structurally (size, palette, layout regions) and the lab will not claim to understand its content.',
    };
  }
}

/** Deterministic text templates used by the offline provider. */
function renderTemplate(task, data = {}) {
  switch (task) {
    case 'design-summary':
      return [
        `${data.name} - ${data.pitch}`,
        `Genre: ${data.genre}. Goal: ${data.goal}. Modifier: ${data.twist}.`,
        `Core loop: ${(data.coreLoop || []).join(' -> ')}.`,
        `Built from ${data.modules?.length || 0} engine modules with a ${data.loopStyle} loop.`,
      ].join('\n');
    case 'project-summary':
      return `${data.name}: ${data.kind}, ${data.files} file(s), ${data.concepts} concept(s) extracted. ${data.summary || ''}`;
    case 'fix-explanation':
      return `Check "${data.check}" failed: ${data.detail}. Applied ${JSON.stringify(data.change)} because ${data.why}.`;
    default:
      return JSON.stringify(data, null, 2);
  }
}
