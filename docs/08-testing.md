# 8. 测试策略

本文档描述 CC-Tuner 的测试架构、工具链和各类测试的编写规范。

## 8.1 测试工具链

| 测试类型 | 工具 | 位置 |
|---|---|---|
| 单元测试 | Vitest | `tests/unit/` |
| 组件测试 | Vitest + @vue/test-utils | `tests/unit/components/` |
| E2E 测试 | Playwright (Electron) | `tests/e2e/` |
| 类型检查 | tsc --noEmit | CI 中运行 |
| Lint | ESLint + TypeScript ESLint | CI 中运行 |

### package.json scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test tests/e2e/",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.vue"
  }
}
```

## 8.2 单元测试

### 8.2.1 服务层测试

**测试目标**: 各服务的核心方法在隔离环境下的正确性。

**示例**: `tests/unit/services/config-manager.spec.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ConfigManager } from "../../../electron/services/config-manager";
import { readFile, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

describe("ConfigManager", () => {
  let manager: ConfigManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `cc-tuner-test-${Date.now()}`);
    manager = new ConfigManager(testDir); // 注入测试路径
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("返回空对象当文件不存在", async () => {
    const result = await manager.read();
    expect(result).toEqual({});
  });

  it("正确读取并解析 settings.json", async () => {
    const expected = { baseUrl: "https://api.test.com", model: "test-model" };
    await manager.write(expected);
    const result = await manager.read();
    expect(result).toEqual(expected);
  });

  it("profileToSettings 正确转换", () => {
    const profile = {
      baseUrl: "https://api.test.com",
      apiKey: "sk-test",
      model: "test-model",
      timeout: 30000,
    };
    const result = manager.profileToSettings(profile);
    expect(result).toEqual({
      baseUrl: "https://api.test.com",
      apiKey: "sk-test",
      model: "test-model",
      timeout: 30000,
    });
  });

  it("timeout 为 0 时不包含 timeout 字段", () => {
    const profile = {
      baseUrl: "https://api.test.com",
      apiKey: "sk-test",
      model: "test-model",
      timeout: 0,
    };
    const result = manager.profileToSettings(profile);
    expect(result).not.toHaveProperty("timeout");
  });
});
```

### 8.2.2 SecurityService 测试

**注意**: `safeStorage` 在测试环境中可能不可用（依赖系统加密服务），需要 mock：

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock electron safeStorage
vi.mock("electron", () => ({
  safeStorage: {
    encryptString: vi.fn((text: string) => Buffer.from(`encrypted:${text}`)),
    decryptString: vi.fn((buf: Buffer) => buf.toString().replace("encrypted:", "")),
    isEncryptionAvailable: vi.fn(() => true),
  },
}));

describe("SecurityService", () => {
  it("加密后可解密还原", () => {
    const { securityService } = require("../../../electron/services/security");
    const key = "sk-ant-test-12345";
    const encrypted = securityService.encrypt(key);
    expect(encrypted).not.toBe(key);
    expect(securityService.decrypt(encrypted)).toBe(key);
  });
});
```

### 8.2.3 ProfileManager 测试

ProfileManager 依赖文件系统，使用临时目录测试：

```typescript
describe("ProfileManager", () => {
  it("创建 Profile 并分配 UUID", async () => {
    const pm = new ProfileManager(testDir);
    const profile = await pm.create({
      name: "测试方案",
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com",
      encryptedApiKey: "encrypted-key",
      model: "claude-sonnet-4-20250514",
      timeout: 0,
    });
    expect(profile.id).toBeDefined();
    expect(profile.name).toBe("测试方案");
    expect(profile.isActive).toBe(false);
    expect(profile.createdAt).toBeDefined();
  });

  it("setActive 只设置一个为激活状态", async () => {
    const pm = new ProfileManager(testDir);
    const p1 = await pm.create({ name: "A", /* ... */ });
    const p2 = await pm.create({ name: "B", /* ... */ });
    await pm.setActive(p2.id);
    const profiles = await pm.list();
    expect(profiles.find((p) => p.id === p1.id)!.isActive).toBe(false);
    expect(profiles.find((p) => p.id === p2.id)!.isActive).toBe(true);
  });
});
```

### 8.2.4 ValidatorService 测试

ValidatorService 发送真实 HTTP 请求，使用 msw（Mock Service Worker）或 nock 拦截：

```typescript
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const server = setupServer(
  http.post("https://api.test.com/v1/messages", async () => {
    return HttpResponse.json({
      id: "msg-test",
      content: [{ type: "text", text: "hi" }],
    });
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("ValidatorService", () => {
  it("成功连接时返回 ok=true", async () => {
    const result = await validatorService.testConnection(
      "https://api.test.com",
      "sk-test",
      "test-model",
    );
    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeDefined();
  });

  it("超时时返回错误", async () => {
    server.use(
      http.post("https://api.slow.com/v1/messages", async () => {
        await new Promise((r) => setTimeout(r, 20000)); // 超时
        return HttpResponse.json({});
      }),
    );
    const result = await validatorService.testConnection(
      "https://api.slow.com",
      "sk-test",
      "test-model",
    );
    expect(result.ok).toBe(false);
    expect(result.message).toContain("timeout");
  });
});
```

## 8.3 IPC 测试

IPC handler 的测试需要模拟 `ipcMain.handle` 的调用环境：

```typescript
describe("IPC: profiles:create", () => {
  it("校验失败时返回 VALIDATION_ERROR", async () => {
    const handler = getIpcHandler("profiles:create");
    const result = await handler({}, { name: "" }); // 空名称
    expect(result.success).toBe(false);
    expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("创建成功时返回 Profile", async () => {
    const handler = getIpcHandler("profiles:create");
    const result = await handler({}, {
      name: "测试",
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com",
      apiKey: "sk-test",
      model: "claude-sonnet-4",
      timeout: 0,
    });
    expect(result.success).toBe(true);
    expect(result.data.name).toBe("测试");
  });
});
```

## 8.4 组件测试

使用 `@vue/test-utils` + `jsdom` 环境：

```typescript
import { mount } from "@vue/test-utils";
import { describe, it, expect } from "vitest";
import ProfileCard from "../../src/components/ProfileCard.vue";

describe("ProfileCard", () => {
  const mockProfile = {
    id: "1",
    name: "Anthropic 官方",
    provider: "anthropic",
    baseUrl: "https://api.anthropic.com",
    model: "claude-sonnet-4-20250514",
    timeout: 0,
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  it("渲染方案名称", () => {
    const wrapper = mount(ProfileCard, {
      props: { profile: mockProfile, isActive: true },
    });
    expect(wrapper.text()).toContain("Anthropic 官方");
  });

  it("激活状态显示「使用中」", () => {
    const wrapper = mount(ProfileCard, {
      props: { profile: mockProfile, isActive: true },
    });
    expect(wrapper.text()).toContain("使用中");
  });

  it("点击卡片触发 select 事件", async () => {
    const wrapper = mount(ProfileCard, {
      props: { profile: mockProfile, isActive: false },
    });
    await wrapper.trigger("click");
    expect(wrapper.emitted("select")).toBeTruthy();
    expect(wrapper.emitted("select")![0]).toEqual(["1"]);
  });
});
```

## 8.5 E2E 测试

使用 Playwright 的 Electron 支持，直接测试完整应用：

```typescript
// tests/e2e/main.spec.ts
import { _electron as electron } from "playwright";
import { test, expect } from "@playwright/test";

test.describe("CC-Tuner E2E", () => {
  test("启动应用并显示主界面", async () => {
    const app = await electron.launch({
      args: ["."],
      cwd: process.cwd(),
    });

    const window = await app.firstWindow();
    await window.waitForLoadState();

    // 检查主界面元素
    await expect(window.locator("fluent-toolbar")).toBeVisible();
    await expect(window.locator('fluent-button:has-text("新建方案")')).toBeVisible();

    await app.close();
  });

  test("创建 Profile 并验证切换", async () => {
    const app = await electron.launch({ args: ["."] });
    const window = await app.firstWindow();

    // 点击新建
    await window.click('fluent-button:has-text("新建方案")');
    // 填写表单...
    // 验证卡片出现...
    // 点击切换...
    // 验证 Toast...

    await app.close();
  });
});
```

## 8.6 测试覆盖率目标

| 模块 | 行覆盖率目标 |
|---|---|
| 服务层 (services/) | ≥ 80% |
| IPC handler (ipc/) | ≥ 90% |
| Composables | ≥ 70% |
| Vue 组件 | ≥ 50%（覆盖交互逻辑，非样式） |

## 8.7 测试数据隔离

- 所有测试使用临时目录（`tmpdir()`）而不是真实路径
- 每个测试用例独立的数据目录，避免互相干扰
- `beforeEach` / `afterEach` 清理临时文件

## 相关文档

- [服务层设计](04-services.md) — 被测试的服务接口
- [UI 开发指南](06-ui-guide.md) — 被测试的 Vue 组件
- [构建与发布](09-build-deploy.md) — CI/CD 中的测试集成
