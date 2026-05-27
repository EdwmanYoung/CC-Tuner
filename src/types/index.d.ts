/** CC-Tuner shared TypeScript types */
/** Model provider enum */
export declare enum Provider {
    Anthropic = "anthropic",
    OpenRouter = "openrouter",
    DeepSeek = "deepseek",
    Ollama = "ollama",
    VLLM = "vllm",
    Custom = "custom"
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
}
/** Provider default configs */
export interface ProviderDefaults {
    provider: Provider;
    defaultBaseUrl: string;
    requiresApiKey: boolean;
    availableModels: string[];
}
export declare const PROVIDER_CONFIGS: Record<Provider, ProviderDefaults>;
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
                switch: (id: string) => Promise<{
                    success: boolean;
                    message: string;
                }>;
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
                openClaude: () => Promise<{
                    ok: boolean;
                    message: string;
                }>;
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
