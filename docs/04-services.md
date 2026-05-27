# 4. 服务层设计

所有服务运行在 Electron 主进程中，由 IPC 处理器调用。服务层不直接暴露给渲染进程。

文件位置: `electron/services/`

## 4.1 ConfigManager

**文件**: `electron/services/config-manager.ts`

**职责**: 读写 `~/.claude/settings.json`，确保文件格式正确。

```typescript
import { readFile, writeFile, access } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

class ConfigManager {
  private settingsPath: string;

  constructor() {
    this.settingsPath = join(homedir(), ".claude", "settings.json");
  }

  /** 读取当前 settings.json，文件不存在时返回空对象 */
  async read(): Promise<Record<string, unknown>> {
    try {
      const raw = await readFile(this.settingsPath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  /** 写入 settings.json，自动创建父目录 */
  async write(data: Record<string, unknown>): Promise<void> {
    const dir = join(homedir(), ".claude");
    // 确保目录存在
    try {
      await access(dir);
    } catch {
      // mkdir -p 语义
      await import("fs/promises").then(({ mkdir }) =>
        mkdir(dir, { recursive: true }),
      );
    }
    await writeFile(this.settingsPath, JSON.stringify(data, null, 2), "utf-8");
  }

  /** 将 Profile 转换为 settings.json 格式 */
  profileToSettings(
    profile: { baseUrl: string; apiKey: string; model: string; timeout: number },
  ): Record<string, unknown> {
    const settings: Record<string, unknown> = {
      baseUrl: profile.baseUrl,
      apiKey: profile.apiKey,
      model: profile.model,
    };
    if (profile.timeout > 0) {
      settings.timeout = profile.timeout;
    }
    return settings;
  }
}

export const configManager = new ConfigManager();
```

**依赖**: 无外部服务依赖

## 4.2 ProfileManager

**文件**: `electron/services/profile-manager.ts`

**职责**: Profile 的 CRUD 操作，数据持久化到 `~/.cc-tuner/profiles.json`。

```typescript
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { app } from "electron";
import { Profile, Provider } from "../types";

class ProfileManager {
  private profilesPath: string;

  constructor() {
    this.profilesPath = join(app.getPath("userData"), "profiles.json");
  }

  /** 读取所有 Profile */
  async list(): Promise<Profile[]> {
    try {
      const raw = await readFile(this.profilesPath, "utf-8");
      const data = JSON.parse(raw);
      return data.profiles ?? [];
    } catch {
      return [];
    }
  }

  /** 保存全部 Profile（覆盖写入） */
  private async save(profiles: Profile[]): Promise<void> {
    const { mkdir } = await import("fs/promises");
    await mkdir(join(app.getPath("userData")), { recursive: true });
    await writeFile(
      this.profilesPath,
      JSON.stringify({ version: 1, profiles }, null, 2),
      "utf-8",
    );
  }

  /** 创建新 Profile */
  async create(profile: Omit<Profile, "id" | "isActive" | "createdAt" | "updatedAt">): Promise<Profile> {
    const profiles = await this.list();
    const now = new Date().toISOString();
    const newProfile: Profile = {
      ...profile,
      id: crypto.randomUUID(),
      isActive: false,
      createdAt: now,
      updatedAt: now,
    };
    profiles.push(newProfile);
    await this.save(profiles);
    return newProfile;
  }

  /** 更新 Profile */
  async update(id: string, updates: Partial<Profile>): Promise<Profile | null> {
    const profiles = await this.list();
    const idx = profiles.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    profiles[idx] = {
      ...profiles[idx],
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    };
    await this.save(profiles);
    return profiles[idx];
  }

  /** 删除 Profile */
  async delete(id: string): Promise<boolean> {
    const profiles = await this.list();
    const filtered = profiles.filter((p) => p.id !== id);
    if (filtered.length === profiles.length) return false;
    await this.save(filtered);
    return true;
  }

  /** 根据 ID 获取 Profile */
  async get(id: string): Promise<Profile | null> {
    const profiles = await this.list();
    return profiles.find((p) => p.id === id) ?? null;
  }

  /** 设置某个 Profile 为激活状态（其他设为非激活） */
  async setActive(id: string): Promise<Profile[]> {
    const profiles = await this.list();
    for (const p of profiles) {
      p.isActive = p.id === id;
    }
    await this.save(profiles);
    return profiles;
  }
}

export const profileManager = new ProfileManager();
```

**依赖**: `SecurityService`（创建/更新时加密 API Key）

## 4.3 SecurityService

**文件**: `electron/services/security.ts`

**职责**: API Key 的加密和解密。使用 OS 级别的加密。

```typescript
import { safeStorage } from "electron";

class SecurityService {
  /**
   * 加密明文 API Key
   * 返回 base64 编码的加密数据
   */
  encrypt(plainText: string): string {
    const encrypted = safeStorage.encryptString(plainText);
    return encrypted.toString("base64");
  }

  /**
   * 解密 base64 编码的加密数据
   * 抛出异常时由调用方处理（如 safeStorage 不可用）
   */
  decrypt(encryptedBase64: string): string {
    const buffer = Buffer.from(encryptedBase64, "base64");
    return safeStorage.decryptString(buffer);
  }

  /** 检查系统加密是否可用 */
  isEncryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }
}

export const securityService = new SecurityService();
```

**技术选型说明**:

| 方案 | 平台 | 底层实现 |
|---|---|---|
| `safeStorage` (Electron) | Windows | DPAPI (CryptProtectData) |
| | macOS | Keychain |
| | Linux | libsecret / Keyring |

**不选方案及原因**:
- 不自实现 AES 加密：密钥管理困难，不如 OS 级别加密安全
- 不使用 `keytar` 包：已被 Electron 官方弃用，`safeStorage` 是替代方案

## 4.4 ValidatorService

**文件**: `electron/services/validator.ts`

**职责**: 测试指定配置的 API 连通性。

```typescript
class ValidatorService {
  /**
   * 验证 API 连通性
   * 发送最小化请求（Anthropic: GET /v1/models 或 POST /v1/messages 带最小 body）
   */
  async testConnection(
    baseUrl: string,
    apiKey: string,
    model: string,
  ): Promise<{ ok: boolean; message: string; latencyMs?: number }> {
    const start = Date.now();
    try {
      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
        signal: AbortSignal.timeout(15000), // 15 秒超时
      });

      const latencyMs = Date.now() - start;

      if (response.ok) {
        return { ok: true, message: "连接成功", latencyMs };
      }

      // 非 2xx：解析错误信息
      const body = await response.json().catch(() => null);
      const errorMsg = body?.error?.message ?? `HTTP ${response.status}`;
      return { ok: false, message: errorMsg, latencyMs };
    } catch (err: unknown) {
      const latencyMs = Date.now() - start;
      const message =
        err instanceof Error ? err.message : "未知网络错误";
      return { ok: false, message, latencyMs };
    }
  }
}

export const validatorService = new ValidatorService();
```

## 4.5 BackupManager

**文件**: `electron/services/backup-manager.ts`

**职责**: 管理 `settings.json` 的备份和恢复。

```typescript
import { readFile, writeFile, readdir } from "fs/promises";
import { join } from "path";
import { app } from "electron";
import { BackupRecord } from "../types";

const MAX_BACKUPS = 10;

class BackupManager {
  private backupDir: string;

  constructor() {
    this.backupDir = join(app.getPath("userData"), "backups");
  }

  /** 备份当前 settings.json */
  async backup(
    trigger: "switch" | "manual",
    targetProfileId?: string,
  ): Promise<BackupRecord | null> {
    const { ConfigManager } = await import("./config-manager");
    const { configManager } = ConfigManager;

    let content: string;
    try {
      content = await (configManager as any).read().then(JSON.stringify);
    } catch {
      return null; // 无现有配置，跳过备份
    }

    const record: BackupRecord = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      content,
      trigger,
      targetProfileId,
    };

    const { mkdir } = await import("fs/promises");
    await mkdir(this.backupDir, { recursive: true });

    const filePath = join(this.backupDir, `${record.id}.json`);
    await writeFile(filePath, JSON.stringify(record, null, 2), "utf-8");

    // 清理旧备份
    await this.prune();

    return record;
  }

  /** 恢复指定备份 */
  async restore(backupId: string): Promise<boolean> {
    const filePath = join(this.backupDir, `${backupId}.json`);
    const raw = await readFile(filePath, "utf-8");
    const record: BackupRecord = JSON.parse(raw);

    const { ConfigManager } = await import("./config-manager");
    const { configManager } = ConfigManager;
    await configManager.write(JSON.parse(record.content));

    return true;
  }

  /** 获取所有备份列表 */
  async listBackups(): Promise<BackupRecord[]> {
    const { readdir } = await import("fs/promises");
    let files: string[];
    try {
      files = await readdir(this.backupDir);
    } catch {
      return [];
    }

    const records: BackupRecord[] = [];
    for (const file of files.filter((f) => f.endsWith(".json"))) {
      const raw = await readFile(join(this.backupDir, file), "utf-8");
      records.push(JSON.parse(raw));
    }
    return records.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }

  /** 保留最近 MAX_BACKUPS 份备份 */
  private async prune(): Promise<void> {
    const backups = await this.listBackups();
    const { rm } = await import("fs/promises");
    for (const old of backups.slice(MAX_BACKUPS)) {
      await rm(join(this.backupDir, `${old.id}.json`));
    }
  }
}

export const backupManager = new BackupManager();
```

## 4.6 ShellService

**文件**: `electron/services/shell-service.ts`

**职责**: 从应用内启动外部进程（终端 + Claude Code）。

```typescript
import { exec } from "child_process";
import { promisify } from "util";
import { platform } from "os";

const execAsync = promisify(exec);

class ShellService {
  /** 打开系统终端并执行 claude 命令 */
  async openClaude(): Promise<{ ok: boolean; message: string }> {
    const os = platform();
    try {
      switch (os) {
        case "win32":
          // Windows: 打开新的 cmd 窗口
          await execAsync(
            'start cmd /k "claude"',
            { windowsHide: false },
          );
          break;
        case "darwin":
          // macOS: 打开新的 Terminal 标签
          await execAsync(
            'osascript -e \'tell application "Terminal" to do script "claude"\'',
          );
          break;
        default:
          // Linux: 尝试常见终端
          await execAsync(
            '(gnome-terminal -- claude || x-terminal-emulator -e claude || xterm -e claude) &',
          );
          break;
      }
      return { ok: true, message: "已启动 Claude Code" };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "启动失败";
      return { ok: false, message };
    }
  }
}

export const shellService = new ShellService();
```

## 4.7 服务依赖关系图

```
┌─────────────────────────────────────────────┐
│              IPC Handler Layer               │
└──┬──────┬──────┬───────┬───────┬──────┬─────┘
   │      │      │       │       │      │
   ▼      ▼      ▼       ▼       ▼      ▼
┌──────┐┌──────┐┌────────┐┌────────┐┌────┐┌──────┐
│Config││Profile││Security││Validator││Bkup││Shell │
│Manager││Manager││Service ││Service  ││Mgr ││Service│
└──┬───┘└──┬───┘└───┬────┘└────────┘└─┬──┘└──────┘
   │        │       │                  │
   │        │  ┌────▼──────────────┐   │
   │        │  │ Electron safeStorage│   │
   │        │  └───────────────────┘   │
   │        │                          │
   ▼        ▼                          ▼
settings.json  profiles.json     backups/
```

### 关键调用链

**切换配置流程** (`config:switch`):

```
IPC Handler → BackupManager.backup()
            → ProfileManager.get(id)
            → SecurityService.decrypt(encryptedApiKey)
            → ValidatorService.testConnection()  (可选)
            → ConfigManager.write(profileToSettings())
            → ProfileManager.setActive(id)
```

**创建 Profile 流程** (`profiles:create`):

```
IPC Handler → SecurityService.encrypt(apiKey)
            → ProfileManager.create({ ...encryptedApiKey })
```

## 相关文档

- [数据模型](03-data-models.md) — Profile、BackupRecord 等结构定义
- [IPC 规范](05-ipc-spec.md) — 服务暴露给渲染进程的 IPC 接口
- [安全设计](07-security.md) — 加密方案详细说明
- [测试策略](08-testing.md) — 服务层单测策略
