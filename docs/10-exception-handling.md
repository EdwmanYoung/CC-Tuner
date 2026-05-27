# 10. 异常处理

本文档定义 CC-Tuner 的错误码体系、异常处理流程和 UI 反馈规范。

## 10.1 错误码定义

### 错误码分类

| 前缀 | 类别 | 示例 |
|---|---|---|
| `VALIDATION_` | 输入校验错误 | `VALIDATION_ERROR` |
| `ENCRYPTION_` | 加密/解密错误 | `ENCRYPTION_ERROR`, `ENCRYPTION_UNAVAILABLE` |
| `DECRYPTION_` | 解密错误 | `DECRYPTION_ERROR` |
| `CONNECTION_` | 网络/连通性错误 | `CONNECTION_FAILED`, `CONNECTION_TIMEOUT` |
| `FILE_` | 文件系统错误 | `FILE_NOT_FOUND`, `WRITE_FAILED` |
| `BACKUP_` | 备份相关错误 | `BACKUP_FAILED`, `BACKUP_NOT_FOUND`, `RESTORE_FAILED` |
| `NOT_FOUND` | 资源不存在 | `NOT_FOUND` |
| `INTERNAL_` | 内部错误 | `INTERNAL_ERROR` |

### 完整错误码表

| 错误码 | 类别 | 说明 | 可恢复 |
|---|---|---|---|
| `VALIDATION_ERROR` | 校验 | 输入字段校验失败（名称为空、URL 无效等） | 是 — 用户修正输入 |
| `NOT_FOUND` | 资源 | Profile 或备份不存在 | 是 — 刷新列表 |
| `ENCRYPTION_ERROR` | 加密 | API Key 加密失败（safeStorage 异常） | 部分 — 检查系统加密服务 |
| `ENCRYPTION_UNAVAILABLE` | 警告 | 系统加密不可用（非致命警告） | 是 — 可继续但明文存储 |
| `DECRYPTION_ERROR` | 解密 | API Key 解密失败（Key 损坏或跨用户） | 部分 — 需重新输入 API Key |
| `CONNECTION_FAILED` | 网络 | API 连通性验证失败（HTTP 非 2xx） | 是 — 检查网络/Key |
| `CONNECTION_TIMEOUT` | 网络 | API 请求超时（>15s） | 是 — 检查网络/baseUrl |
| `FILE_NOT_FOUND` | 文件 | settings.json 或 profiles.json 不存在 | 是 — 创建新文件 |
| `WRITE_FAILED` | 文件 | 写入 settings.json 失败（权限/磁盘空间） | 部分 — 检查文件权限 |
| `BACKUP_FAILED` | 备份 | 备份操作失败（非致命，切换仍可进行） | 是 — 检查磁盘空间 |
| `BACKUP_NOT_FOUND` | 备份 | 指定的备份记录不存在 | 是 — 刷新备份列表 |
| `RESTORE_FAILED` | 备份 | 恢复备份失败（备份文件损坏） | 否 — 需手动修复 settings.json |
| `INTERNAL_ERROR` | 内部 | 未预期的内部错误 | 否 — 需查看日志排查 |

## 10.2 自定义错误类

```typescript
// electron/types/errors.ts

class CCError extends Error {
  constructor(
    public code: string,
    message: string,
    public recoverable: boolean = true,
  ) {
    super(message);
    this.name = "CCError";
  }
}

class ValidationError extends CCError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message);
    this.name = "ValidationError";
  }
}

class EncryptionError extends CCError {
  constructor(message: string, recoverable = false) {
    super("ENCRYPTION_ERROR", message, recoverable);
    this.name = "EncryptionError";
  }
}

class DecryptionError extends CCError {
  constructor(message: string) {
    super("DECRYPTION_ERROR", message, false);
    this.name = "DecryptionError";
  }
}

class ConnectionError extends CCError {
  constructor(message: string, recoverable = true) {
    super("CONNECTION_FAILED", message, recoverable);
    this.name = "ConnectionError";
  }
}
```

## 10.3 异常处理流程

### 10.3.1 主进程层

服务层抛出 `CCError`，IPC handler 统一捕获：

```typescript
// ipc/profiles.ts
ipcMain.handle("profiles:create", async (_event, input) => {
  try {
    // 输入校验（在服务之前）
    validateCreateInput(input);

    const profile = await profileManager.create(input);
    return { success: true, data: profile };
  } catch (err: unknown) {
    if (err instanceof CCError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    // 未知错误
    console.error("[IPC] Unexpected error:", err);
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "内部错误，请查看日志" },
    };
  }
});
```

### 10.3.2 渲染进程层

Composable 统一处理 IPC 响应：

```typescript
// composables/useToast.ts
async function handleIpc<T>(
  fn: () => Promise<{ success: boolean; data?: T; error?: { code: string; message: string } }>,
  onSuccess?: (data: T) => void,
): Promise<T | null> {
  try {
    const result = await fn();
    if (!result.success) {
      showErrorToast(result.error!);
      return null;
    }
    onSuccess?.(result.data!);
    return result.data!;
  } catch (err: unknown) {
    showToast("error", "通信错误: " + (err instanceof Error ? err.message : "未知错误"));
    return null;
  }
}

function showErrorToast(error: { code: string; message: string }) {
  const intent = mapErrorCodeToIntent(error.code);
  showToast(intent, error.message);
}

function mapErrorCodeToIntent(code: string): "error" | "warning" | "info" {
  switch (code) {
    case "ENCRYPTION_UNAVAILABLE":
      return "warning";
    case "BACKUP_FAILED":
      return "warning"; // 非致命
    default:
      return "error";
  }
}
```

## 10.4 UI 反馈规范

### 10.4.1 Toast / MessageBar 使用规则

| 场景 | 组件 | intent | 持续时间 |
|---|---|---|---|
| 切换成功 | `<fluent-message-bar>` | `success` | 3000ms |
| 创建/编辑成功 | `<fluent-message-bar>` | `success` | 3000ms |
| 加密不可用警告 | `<fluent-message-bar>` | `warning` | 持续显示 |
| 校验错误 | `<fluent-message-bar>` | `error` | 5000ms |
| 网络错误 | `<fluent-message-bar>` | `error` | 5000ms |
| 内部错误 | `<fluent-message-bar>` | `error` | 5000ms |

### 10.4.2 Toast 示例

```vue
<!-- 成功 -->
<fluent-message-bar intent="success">
  已切换至方案 "Anthropic 官方"
</fluent-message-bar>

<!-- 错误 -->
<fluent-message-bar intent="error">
  切换失败: 无法连接到 API — 请检查网络或 API Key
</fluent-message-bar>

<!-- 警告 -->
<fluent-message-bar intent="warning">
  系统加密服务不可用，API Key 将以明文存储
</fluent-message-bar>
```

### 10.4.3 编辑对话框内联校验

在 EditorDialog 中，字段级校验错误显示在字段下方：

```vue
<fluent-text-field id="name" :error="errors.name">
  方案名称
</fluent-text-field>
<span v-if="errors.name" class="field-error">{{ errors.name }}</span>
```

```css
.field-error {
  color: var(--cc-color-error);
  font-size: 12px;
  margin-top: 4px;
}
```

### 10.4.4 加载状态

切换操作期间：

```vue
<fluent-button
  appearance="accent"
  :disabled="isSwitching"
  @click="$emit('switch', profile.id)"
>
  <span v-if="isSwitching" class="spinner"></span>
  {{ isSwitching ? "切换中..." : "切换" }}
</fluent-button>
```

## 10.5 降级策略

### 10.5.1 settings.json 损坏

如果读取 `~/.claude/settings.json` 时解析失败：

1. 不抛出错误，返回空对象 `{}`
2. 切换操作基于空对象写入
3. 原始损坏文件自动备份

### 10.5.2 profiles.json 损坏

如果读取 `~/.cc-tuner/profiles.json` 时解析失败：

1. 返回空数组 `[]`
2. 在 UI 显示警告："配置数据损坏，已重新初始化"
3. 创建新的空 profiles.json

### 10.5.3 备份失败不影响切换

`config:switch` 流程中，如果 `BackupManager.backup()` 失败：

1. 记录警告日志
2. 继续执行切换流程
3. UI 显示切换结果（成功/失败），不额外弹出备份错误

### 10.5.4 网络不可用

- `config:test` 在网络断开时返回 `CONNECTION_TIMEOUT`
- UI 提示"网络不可用，请检查网络连接"
- 用户仍可选择跳过验证直接切换

## 10.6 日志

主进程记录关键操作日志：

```typescript
// 简单日志工具
const logPrefix = "[CC-Tuner]";

export function logInfo(...args: unknown[]) {
  console.log(logPrefix, "[INFO]", ...args);
}

export function logError(...args: unknown[]) {
  console.error(logPrefix, "[ERROR]", ...args);
}

export function logWarn(...args: unknown[]) {
  console.warn(logPrefix, "[WARN]", ...args);
}
```

关键日志点：
- IPC handler 入口和出口
- 服务层错误
- settings.json 读写前后
- 备份/恢复操作

## 相关文档

- [IPC 规范](05-ipc-spec.md) — IPC 错误传播机制
- [UI 开发指南](06-ui-guide.md) — Toast/MessageBar 组件使用
- [安全设计](07-security.md) — 加密/解密错误处理
