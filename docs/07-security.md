# 7. 安全设计

本文档描述 CC-Tuner 的安全策略，涵盖 API Key 加密、存储、IPC 安全和文件系统权限。

## 7.1 API Key 加密方案

### 7.1.1 技术方案

使用 Electron `safeStorage` API 进行加密。这是 Electron 官方推荐的密钥存储方案，底层调用操作系统级别的加密 API：

| 平台 | 底层实现 | 特点 |
|---|---|---|
| Windows | DPAPI (CryptProtectData) | 绑定当前用户账户，同用户下无需额外密码 |
| macOS | Keychain Services | 系统级密钥管理，支持 Touch ID |
| Linux | libsecret (Secret Service API) | 依赖 GNOME Keyring 或 KWallet |

### 7.1.2 加密流程

```
用户输入 API Key（明文）
  │
  ▼
SecurityService.encrypt(plainText)
  │
  ▼
safeStorage.encryptString(plainText)
  │
  ▼
Buffer → base64 编码 → 存储到 profiles.json
```

### 7.1.3 解密流程

```
切换 Profile 时
  │
  ▼
读取 profiles.json 中的 encryptedApiKey（base64 字符串）
  │
  ▼
SecurityService.decrypt(encryptedBase64)
  │
  ▼
safeStorage.decryptString(buffer) → 明文 API Key（仅在内存中）
  │
  ▼
发送给 API 验证 → 用后立即丢弃（不写入任何文件）
```

### 7.1.4 安全属性

| 属性 | 实现 |
|---|---|
| 静态加密 | 存储时加密，密钥由 OS 管理 |
| 传输中安全 | API Key 从主进程 → 渲染进程 **不传输明文**；仅在发送 API 请求时在主进程内使用 |
| 内存安全 | 解密后的明文 Key 仅在 Node.js 主进程内存中，不暴露给渲染进程 |
| 跨用户隔离 | DPAPI/Keychain 绑定当前 OS 用户，其他用户无法解密 |

### 7.1.5 降级处理

如果 `safeStorage.isEncryptionAvailable()` 返回 false：

1. 在启动时检测并显示警告通知
2. 允许用户继续使用（不强制阻止），但明确提示 "API Key 将以明文存储"
3. 在 UI 上提供醒目的安全警告

```typescript
// main.ts 启动时检测
if (!safeStorage.isEncryptionAvailable()) {
  mainWindow.webContents.send("system:warning", {
    code: "ENCRYPTION_UNAVAILABLE",
    message:
      "系统加密服务不可用，API Key 将以明文存储。请检查系统密钥管理服务是否正常运行。",
  });
}
```

## 7.2 IPC 安全

### 7.2.1 contextIsolation

Electron 的 `webPreferences` 必须配置：

```typescript
const mainWindow = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,    // 禁止渲染进程访问 Node.js
    contextIsolation: true,    // 启用上下文隔离
    preload: path.join(__dirname, "preload.js"),
  },
  frame: false,                // 无边框窗口
});
```

### 7.2.2 contextBridge 最小化暴露

preload.ts **仅**暴露业务所需的函数，不暴露底层 IPC 机制：

```typescript
// 正确：暴露业务函数
contextBridge.exposeInMainWorld("api", {
  profiles: { list: () => ipcRenderer.invoke("profiles:list") },
});

// 错误：暴露 ipcRenderer 本身
contextBridge.exposeInMainWorld("ipc", { renderer: ipcRenderer });
```

### 7.2.3 输入校验

主进程对所有 IPC 输入做校验：

```typescript
ipcMain.handle("profiles:create", async (_event, input) => {
  // 校验输入
  if (!input.name || typeof input.name !== "string") {
    throw new ValidationError("name 是必填的字符串");
  }
  if (!input.baseUrl || !isValidUrl(input.baseUrl)) {
    throw new ValidationError("baseUrl 必须是有效的 URL");
  }
  // ... 其他校验

  const profile = await profileManager.create(input);
  return { success: true, data: profile };
});
```

## 7.3 文件系统安全

### 7.3.1 profiles.json 权限

- 文件位置: `app.getPath("userData")` 下（系统用户专属目录）
- 权限: 默认文件权限 600（仅当前用户可读写）

```typescript
import { chmod } from "fs/promises";

async function save(profiles: Profile[]) {
  await writeFile(this.profilesPath, JSON.stringify(data, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
}
```

### 7.3.2 备份文件

- 备份目录: `app.getPath("userData")/backups/`
- 每个备份文件同样设置 600 权限
- 定期清理（最多保留 10 份）

### 7.3.3 settings.json 读写

- 读写 `~/.claude/settings.json` 时不修改文件权限（保持原始权限）
- 写入使用原子写入策略（先写临时文件，再 rename）防止中途损坏：

```typescript
import { writeFile, rename } from "fs/promises";
import { join, dirname } from "path";

async function write(data: Record<string, unknown>): Promise<void> {
  const tmpPath = this.settingsPath + ".tmp";
  await writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
  await rename(tmpPath, this.settingsPath); // 原子替换
}
```

## 7.4 内存安全

- 解密的 API Key **绝不**写入任何文件
- 解密后仅在函数作用域内的局部变量中持有
- 调用完成后依赖 V8 GC 回收（不主动保留引用）

```typescript
// 正确：解密后直接用，不存变量
async function switchProfile(id: string) {
  const profile = await profileManager.get(id);
  const apiKey = securityService.decrypt(profile.encryptedApiKey!);
  // 直接用 apiKey 验证、写入
  await validatorService.testConnection(profile.baseUrl, apiKey, profile.model);
  await configManager.write(configManager.profileToSettings({ ...profile, apiKey }));
  // apiKey 变量超出作用域，等待 GC
}
```

## 7.5 安全清单

- [x] `nodeIntegration: false`
- [x] `contextIsolation: true`
- [x] `safeStorage` 加密 API Key
- [x] contextBridge 最小化暴露
- [x] IPC 输入校验
- [x] 文件权限 600
- [x] 原子写入 settings.json
- [x] 加密不可用时显示警告
- [x] 明文 API Key 不落盘、不传输到渲染进程

## 相关文档

- [服务层设计](04-services.md) — SecurityService 实现
- [数据模型](03-data-models.md) — Profile.encryptedApiKey 字段
- [异常处理](10-exception-handling.md) — 加密相关错误码
