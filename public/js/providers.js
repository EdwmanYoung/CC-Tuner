// Provider constants and utilities

export const PROVIDERS = {
  anthropic: {
    name: "Anthropic",
    defaultBaseUrl: "https://api.anthropic.com",
    requiresApiKey: true,
    models: ["claude-opus-4-7", "claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"],
  },
  openrouter: {
    name: "OpenRouter",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    requiresApiKey: true,
    models: ["anthropic/claude-sonnet-4", "anthropic/claude-opus"],
  },
  deepseek: {
    name: "DeepSeek",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    requiresApiKey: true,
    models: ["deepseek-chat", "deepseek-coder"],
  },
  ollama: {
    name: "Ollama",
    defaultBaseUrl: "http://localhost:11434/v1",
    requiresApiKey: false,
    models: ["llama3", "mistral", "codellama"],
  },
  vllm: {
    name: "vLLM",
    defaultBaseUrl: "http://localhost:8000/v1",
    requiresApiKey: false,
    models: [],
  },
  custom: {
    name: "自定义",
    defaultBaseUrl: "",
    requiresApiKey: true,
    models: [],
  },
};

export function getProviderEmoji(provider) {
  const map = {
    anthropic: "🎯",
    openrouter: "🌐",
    deepseek: "🔮",
    ollama: "🦙",
    vllm: "🚀",
    custom: "⚡",
  };
  return map[provider] || "⚡";
}

export function shortHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
