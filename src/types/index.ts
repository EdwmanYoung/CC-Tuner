/** CC-Tuner shared TypeScript types */

/** Model provider enum */
export enum Provider {
  Anthropic = "anthropic",
  OpenRouter = "openrouter",
  DeepSeek = "deepseek",
  Ollama = "ollama",
  VLLM = "vllm",
  Custom = "custom",
}

/** Profile data model */
export interface Profile {
  id: string;
  name: string;
  provider: Provider;
  baseUrl: string;
  encryptedApiKey?: string;
  model: string;
  timeout: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  env?: Record<string, string>;
}

/** Claude Code settings.json (env-based format) */
export interface ClaudeSettings {
  env?: Record<string, unknown>;
  enabledPlugins?: Record<string, boolean>;
  [key: string]: unknown;
}

/** Backup record */
export interface BackupRecord {
  id: string;
  timestamp: string;
  content: string;
  trigger: "switch" | "manual";
  targetProfileId?: string;
}

/** Backup summary (without content) */
export interface BackupSummary {
  id: string;
  timestamp: string;
  trigger: "switch" | "manual";
  targetProfileId?: string;
}

/** Test connection result */
export interface TestResult {
  ok: boolean;
  message: string;
  latencyMs?: number;
}

/** History entry */
export interface HistoryEntry {
  id: string;
  timestamp: string;
  action: "create" | "update" | "delete" | "switch";
  profileId: string;
  profileName?: string;
  details: string;
}

/** IPC create profile input */
export interface CreateProfileInput {
  name: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeout: number;
  notes?: string;
  env?: Record<string, string>;
}

/** IPC update profile input */
export interface UpdateProfileInput {
  name?: string;
  provider?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  timeout?: number;
  notes?: string;
  env?: Record<string, string>;
}

/** Provider default configs */
export interface ProviderDefaults {
  provider: Provider;
  defaultBaseUrl: string;
  requiresApiKey: boolean;
  availableModels: string[];
}

export const PROVIDER_CONFIGS: Record<Provider, ProviderDefaults> = {
  [Provider.Anthropic]: {
    provider: Provider.Anthropic,
    defaultBaseUrl: "https://api.anthropic.com",
    requiresApiKey: true,
    availableModels: [
      "claude-opus-4-7",
      "claude-sonnet-4-20250514",
      "claude-haiku-4-5-20251001",
    ],
  },
  [Provider.OpenRouter]: {
    provider: Provider.OpenRouter,
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    requiresApiKey: true,
    availableModels: ["anthropic/claude-sonnet-4", "anthropic/claude-opus"],
  },
  [Provider.DeepSeek]: {
    provider: Provider.DeepSeek,
    defaultBaseUrl: "https://api.deepseek.com/v1",
    requiresApiKey: true,
    availableModels: ["deepseek-chat", "deepseek-coder"],
  },
  [Provider.Ollama]: {
    provider: Provider.Ollama,
    defaultBaseUrl: "http://localhost:11434/v1",
    requiresApiKey: false,
    availableModels: ["llama3", "mistral", "codellama"],
  },
  [Provider.VLLM]: {
    provider: Provider.VLLM,
    defaultBaseUrl: "http://localhost:8000/v1",
    requiresApiKey: false,
    availableModels: [],
  },
  [Provider.Custom]: {
    provider: Provider.Custom,
    defaultBaseUrl: "",
    requiresApiKey: true,
    availableModels: [],
  },
};

/** Window API types for renderer process */
declare global {
  interface Window {
    api: {
      profiles: {
        list: () => Promise<Profile[]>;
        create: (input: CreateProfileInput) => Promise<Profile>;
        update: (id: string, updates: UpdateProfileInput) => Promise<Profile>;
        delete: (id: string) => Promise<boolean>;
      };
      config: {
        switch: (id: string) => Promise<{ success: boolean; message: string }>;
        test: (id: string) => Promise<TestResult>;
        getCurrent: () => Promise<Profile | null>;
      };
      backup: {
        list: () => Promise<BackupSummary[]>;
        restore: (id: string) => Promise<boolean>;
        restoreLatest: () => Promise<boolean>;
        create: () => Promise<boolean>;
      };
      shell: {
        openClaude: () => Promise<{ ok: boolean; message: string }>;
      };
      history: {
        list: () => Promise<HistoryEntry[]>;
      };
      system: {
        encryptionAvailable: () => Promise<boolean>;
        getVersion: () => Promise<string>;
      };
    };
  }
}

export {};
