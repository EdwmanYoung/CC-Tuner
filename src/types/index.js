"use strict";
/** CC-Tuner shared TypeScript types */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROVIDER_CONFIGS = exports.Provider = void 0;
/** Model provider enum */
var Provider;
(function (Provider) {
    Provider["Anthropic"] = "anthropic";
    Provider["OpenRouter"] = "openrouter";
    Provider["DeepSeek"] = "deepseek";
    Provider["Ollama"] = "ollama";
    Provider["VLLM"] = "vllm";
    Provider["Custom"] = "custom";
})(Provider || (exports.Provider = Provider = {}));
exports.PROVIDER_CONFIGS = {
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
