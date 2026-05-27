# 5. IPC 规范

本文档定义渲染进程与主进程之间的 IPC 通信协议。所有通信通过 `contextBridge` 暴露，渲染进程不可直接访问 `ipcRenderer`。

## 5.1 安全架构

```
渲染进程 (Vue)
  │
  │  window.api.profiles.list()
  ▼
contextBridge (preload.ts)
  │
  │  ipcRenderer.invoke('profiles:list')
  ▼
ipcMain.handle('profiles:list')  →  ProfileManager.list()
```

### 安全原则

1. 渲染进程 **不** 开启 `nodeIntegration`
2. 渲染进程 **不** 直接访问 `require` / `process` / `fs`
3. `contextBridge` 仅暴露**最小化**的 API 函数
4. 主进程对所有 IPC 输入做校验

## 5.2 preload.ts 接口定义

**文件**: `electron/preload.ts`

```typescript
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  // Profile CRUD
  profiles: {
    list: () => ipcRenderer.invoke("profiles:list"),
    create: (profile: CreateProfileInput) =>
      ipcRenderer.invoke("profiles:create", profile),
    update: (id: string, updates: UpdateProfileInput) =>
      ipcRenderer.invoke("profiles:update", id, updates),
    delete: (id: string) => ipcRenderer.invoke("profiles:delete", id),
  },

  // Config operations
  config: {
    switch: (id: string) => ipcRenderer.invoke("config:switch", id),
    test: (id: string) => ipcRenderer.invoke("config:test", id),
    getCurrent: () => ipcRenderer.invoke("config:get-current"),
  },

  // Backup
  backup: {
    list: () => ipcRenderer.invoke("backup:list"),
    restore: (id: string) => ipcRenderer.invoke("backup:restore", id),
    restoreLatest: () => ipcRenderer.invoke("backup:restore-latest"),
    create: () => ipcRenderer.invoke("backup:create"),
  },

  // Shell
  shell: {
    openClaude: () => ipcRenderer.invoke("shell:open-claude"),
  },

  // System
  system: {
    encryptionAvailable: () =>
      ipcRenderer.invoke("system:encryption-available"),
    getVersion: () => ipcRenderer.invoke("system:get-version"),
  },
});
```

### TypeScript 声明（渲染进程用）

**文件**: `src/types/index.ts`

```typescript
interface CreateProfileInput {
  name: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeout: number;
  notes?: string;
}

interface UpdateProfileInput {
  name?: string;
  provider?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  timeout?: number;
  notes?: string;
}

interface TestResult {
  ok: boolean;
  message: string;
  latencyMs?: number;
}

interface IpcResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

interface BackupSummary {
  id: string;
  timestamp: string;
  trigger: "switch" | "manual";
  targetProfileId?: string;
}

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
    system: {
      encryptionAvailable: () => Promise<boolean>;
      getVersion: () => Promise<string>;
    };
  };
}
```

## 5.3 IPC 通道完整定义

### 5.3.1 profiles:list

| 属性 | 值 |
|---|---|
| 方向 | 渲染 → 主 |
| 方法 | `ipcRenderer.invoke` / `ipcMain.handle` |
| 请求参数 | 无 |
| 响应类型 | `Profile[]` |
| 错误码 | 无（读取失败返回空数组） |

### 5.3.2 profiles:create

| 属性 | 值 |
|---|---|
| 方向 | 渲染 → 主 |
| 请求参数 | `{ name, provider, baseUrl, apiKey, model, timeout, notes? }` |
| 响应类型 | `Profile`（含 `id`、`isActive`、`createdAt`、`updatedAt`） |
| 错误码 | |

| 错误码 | 说明 |
|---|---|
| `VALIDATION_ERROR` | 输入字段校验失败 |
| `ENCRYPTION_ERROR` | API Key 加密失败 |

### 5.3.3 profiles:update

| 属性 | 值 |
|---|---|
| 方向 | 渲染 → 主 |
| 请求参数 | `id: string`, `{ name?, provider?, baseUrl?, apiKey?, model?, timeout?, notes? }` |
| 响应类型 | `Profile` |
| 错误码 | `NOT_FOUND`（Profile 不存在）、`VALIDATION_ERROR`、`ENCRYPTION_ERROR` |

### 5.3.4 profiles:delete

| 属性 | 值 |
|---|---|
| 方向 | 渲染 → 主 |
| 请求参数 | `id: string` |
| 响应类型 | `boolean` |
| 错误码 | 无（删除不存在的 Profile 返回 false） |

### 5.3.5 config:switch

| 属性 | 值 |
|---|---|
| 方向 | 渲染 → 主 |
| 请求参数 | `id: string` |
| 响应类型 | `{ success: boolean; message: string }` |
| 错误码 | |

| 错误码 | 说明 |
|---|---|
| `NOT_FOUND` | Profile 不存在 |
| `DECRYPTION_ERROR` | API Key 解密失败 |
| `VALIDATION_ERROR` | 配置字段不完整 |
| `CONNECTION_FAILED` | 连通性验证失败 |
| `WRITE_FAILED` | 写入 settings.json 失败 |
| `BACKUP_FAILED` | 备份失败（非致命，仍可切换） |

### 5.3.6 config:test

| 属性 | 值 |
|---|---|
| 方向 | 渲染 → 主 |
| 请求参数 | `id: string` |
| 响应类型 | `{ ok: boolean; message: string; latencyMs?: number }` |
| 错误码 | `NOT_FOUND`、`DECRYPTION_ERROR` |

### 5.3.7 config:get-current

| 属性 | 值 |
|---|---|
| 方向 | 渲染 → 主 |
| 请求参数 | 无 |
| 响应类型 | `Profile | null`（读取 profiles.json 中 isActive=true 的） |
| 错误码 | 无 |

### 5.3.8 backup:list

| 属性 | 值 |
|---|---|
| 方向 | 渲染 → 主 |
| 请求参数 | 无 |
| 响应类型 | `BackupSummary[]`（按时间倒序，不含 content 字段） |
| 错误码 | 无 |

### 5.3.9 backup:restore

| 属性 | 值 |
|---|---|
| 方向 | 渲染 → 主 |
| 请求参数 | `backupId: string` |
| 响应类型 | `boolean` |
| 错误码 | `BACKUP_NOT_FOUND`、`RESTORE_FAILED` |

### 5.3.10 backup:restore-latest

| 属性 | 值 |
|---|---|
| 方向 | 渲染 → 主 |
| 请求参数 | 无 |
| 响应类型 | `boolean`（无备份时返回 false） |
| 错误码 | `RESTORE_FAILED` |

### 5.3.11 backup:create

| 属性 | 值 |
|---|---|
| 方向 | 渲染 → 主 |
| 请求参数 | 无 |
| 响应类型 | `boolean` |
| 错误码 | 无 |

### 5.3.12 shell:open-claude

| 属性 | 值 |
|---|---|
| 方向 | 渲染 → 主 |
| 请求参数 | 无 |
| 响应类型 | `{ ok: boolean; message: string }` |
| 错误码 | 无 |

### 5.3.13 system:encryption-available

| 属性 | 值 |
|---|---|
| 方向 | 渲染 → 主 |
| 请求参数 | 无 |
| 响应类型 | `boolean` |
| 错误码 | 无 |

### 5.3.14 system:get-version

| 属性 | 值 |
|---|---|
| 方向 | 渲染 → 主 |
| 请求参数 | 无 |
| 响应类型 | `string`（应用版本号） |
| 错误码 | 无 |

## 5.4 IPC Handler 注册

**文件**: `electron/ipc/index.ts`

```typescript
import { ipcMain } from "electron";
import { registerProfileHandlers } from "./profiles";
import { registerConfigHandlers } from "./config";
import { registerBackupHandlers } from "./backup";
import { registerShellHandlers } from "./shell";

export function registerIpcHandlers(): void {
  registerProfileHandlers();
  registerConfigHandlers();
  registerBackupHandlers();
  registerShellHandlers();
}
```

每个子模块（如 `profiles.ts`）实现对应通道的 `ipcMain.handle` 注册。

## 5.5 错误传播机制

主进程服务中的错误统一包装为 `Error`，IPC handler 捕获后转换为标准响应格式：

```typescript
// 在 ipc handler 中
ipcMain.handle("profiles:create", async (_event, input) => {
  try {
    const profile = await profileManager.create(input);
    return { success: true, data: profile };
  } catch (err: unknown) {
    const code = err instanceof CustomError ? err.code : "INTERNAL_ERROR";
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: { code, message } };
  }
});
```

渲染进程侧 composable 统一处理响应：

```typescript
// useProfiles.ts
async function createProfile(input: CreateProfileInput) {
  const result = await window.api.profiles.create(input);
  if (!result.success) {
    showToast("error", result.error!.message);
    return null;
  }
  profiles.value.push(result.data!);
  showToast("success", "方案已创建");
  return result.data!;
}
```

## 相关文档

- [数据模型](03-data-models.md) — 传输数据的类型定义
- [服务层设计](04-services.md) — handler 调用的底层服务
- [异常处理](10-exception-handling.md) — 错误码完整列表和 UI 反馈规范
- [UI 开发指南](06-ui-guide.md) — 渲染进程如何调用 IPC API
