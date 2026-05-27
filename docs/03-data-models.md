# 3. 数据模型

本文档定义 CC-Tuner 的核心数据结构。所有类型使用 TypeScript 定义，位于 `src/types/index.ts`。

## 3.1 Claude Code settings.json 结构

这是 Claude Code 读取的配置文件，也是 CC-Tuner 的写入目标。

```typescript
// ~/.claude/settings.json
interface ClaudeSettings {
  /** API 基础 URL */
  baseUrl?: string;
  /** API 认证密钥 */
  apiKey?: string;
  /** 默认使用的模型 ID */
  model?: string;
  /** 请求超时（毫秒） */
  timeout?: number;
  /** 其他 Claude Code 支持的字段 */
  [key: string]: unknown;
}
```

示例：

```json
{
  "baseUrl": "https://api.anthropic.com",
  "apiKey": "sk-ant-xxxxx",
  "model": "claude-sonnet-4-20250514",
  "timeout": 60000
}
```

## 3.2 Provider 枚举

```typescript
enum Provider {
  /** Anthropic 官方 API */
  Anthropic = "anthropic",
  /** OpenRouter 代理 */
  OpenRouter = "openrouter",
  /** DeepSeek */
  DeepSeek = "deepseek",
  /** Ollama 本地服务 */
  Ollama = "ollama",
  /** vLLM 自部署 */
  VLLM = "vllm",
  /** 其他自定义服务 */
  Custom = "custom",
}
```

### Provider 默认配置映射

```typescript
interface ProviderDefaults {
  provider: Provider;
  /** 默认 baseURL */
  defaultBaseUrl: string;
  /** 是否需要 API Key */
  requiresApiKey: boolean;
  /** 常见模型列表（用于下拉选择） */
  availableModels: string[];
}

const PROVIDER_CONFIGS: Record<Provider, ProviderDefaults> = {
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
    availableModels: [
      "anthropic/claude-sonnet-4",
      "anthropic/claude-opus",
    ],
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
```

## 3.3 Profile（配置方案）数据模型

Profile 是 CC-Tuner 管理的核心数据单元。每个 Profile 代表一套完整的模型配置。

```typescript
interface Profile {
  /** 唯一标识，UUID v4 */
  id: string;
  /** 用户自定义的方案名称 */
  name: string;
  /** 模型提供商 */
  provider: Provider;
  /** API 基础 URL */
  baseUrl: string;
  /** 加密后的 API Key（存储态）/ 明文（运行时临时） */
  encryptedApiKey?: string;
  /** 默认模型 ID */
  model: string;
  /** 请求超时（毫秒），0 表示使用默认 */
  timeout: number;
  /** 是否为当前激活的方案 */
  isActive: boolean;
  /** 创建时间戳 (ISO 8601) */
  createdAt: string;
  /** 最后更新时间戳 (ISO 8601) */
  updatedAt: string;
  /** 备注/描述 */
  notes?: string;
}
```

### Profile 校验规则

| 字段 | 规则 |
|---|---|
| `name` | 必填，1-50 字符，不允许为空字符串 |
| `provider` | 必填，必须是 `Provider` 枚举值之一 |
| `baseUrl` | 必填，必须是有效的 HTTP/HTTPS URL |
| `encryptedApiKey` | 当 `Provider.requiresApiKey === true` 时必填 |
| `model` | 必填，1-200 字符 |
| `timeout` | 非负整数，0-600000（0 = 使用系统默认值） |

## 3.4 AppState（应用状态）

渲染进程 Pinia Store 中维护的全局状态。

```typescript
interface AppState {
  /** 所有配置方案列表 */
  profiles: Profile[];
  /** 当前激活的方案 ID */
  activeProfileId: string | null;
  /** 当前主题: 'light' | 'dark' */
  theme: "light" | "dark";
  /** 是否正在执行切换操作 */
  isSwitching: boolean;
  /** 最近一次操作的消息（用于 Toast） */
  lastMessage: ToastMessage | null;
  /** 编辑中的 Profile（用于 EditorDialog） */
  editingProfile: Profile | null;
  /** 是否显示编辑对话框 */
  isEditorOpen: boolean;
  /** 是否显示详情面板 */
  isDetailOpen: boolean;
}

interface ToastMessage {
  type: "success" | "error" | "warning" | "info";
  text: string;
  duration?: number; // 毫秒，默认 3000
}
```

## 3.5 备份记录

```typescript
interface BackupRecord {
  /** 备份 ID */
  id: string;
  /** 备份时间戳 */
  timestamp: string;
  /** 原始 settings.json 的内容（JSON 字符串） */
  content: string;
  /** 触发备份的操作: 'switch' | 'manual' */
  trigger: "switch" | "manual";
  /** 切换到哪个 Profile 触发的备份 */
  targetProfileId?: string;
}
```

## 3.6 IPC 请求/响应通用类型

```typescript
/** IPC 调用的通用响应格式 */
interface IpcResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
```

## 3.7 本地 Profile 存储格式

```typescript
// ~/.cc-tuner/profiles.json
interface ProfilesFile {
  version: 1;
  profiles: Profile[];
}
```

## 相关文档

- [服务层设计](04-services.md) — 使用这些数据模型的服务实现
- [IPC 规范](05-ipc-spec.md) — IPC 通道中的数据传输格式
- [安全设计](07-security.md) — API Key 加密存储方案
