import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConfigManager } from "../../../electron/services/config-manager";
import { readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

describe("ConfigManager", () => {
  let manager: ConfigManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `cc-tuner-config-test-${Date.now()}`);
    manager = new ConfigManager(testDir);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe("read()", () => {
    it("返回空对象当文件不存在", async () => {
      const result = await manager.read();
      expect(result).toEqual({});
    });

    it("正确读取并解析 settings.json", async () => {
      const expected = {
        baseUrl: "https://api.test.com",
        apiKey: "sk-test-123",
        model: "test-model",
      };
      await manager.write(expected);
      const result = await manager.read();
      expect(result).toEqual(expected);
    });

    it("解析损坏的 JSON 时返回空对象", async () => {
      const { writeFile, mkdir } = await import("fs/promises");
      await mkdir(testDir, { recursive: true });
      const settingsPath = join(testDir, "settings.json");
      await writeFile(settingsPath, "{ invalid json }", "utf-8");
      const result = await manager.read();
      expect(result).toEqual({});
    });
  });

  describe("write()", () => {
    it("创建目录并写入 settings.json", async () => {
      const data = { baseUrl: "https://api.test.com" };
      await manager.write(data);
      const content = await readFile(
        join(testDir, "settings.json"),
        "utf-8",
      );
      expect(JSON.parse(content)).toEqual(data);
    });

    it("格式化输出（2 空格缩进）", async () => {
      const data = { a: 1, b: 2 };
      await manager.write(data);
      const content = await readFile(
        join(testDir, "settings.json"),
        "utf-8",
      );
      expect(content).toContain("  ");
    });
  });

  describe("profileToSettings()", () => {
    it("正确转换 Profile 为 settings 格式", () => {
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

  describe("writeProfile()", () => {
    it("写入 env-based 格式并保留其他字段", async () => {
      // 先写入模拟现有配置
      await manager.write({
        enabledPlugins: ["foo"],
        someOtherSetting: "bar",
        env: { EXISTING_VAR: "keep-me" },
      });

      await manager.writeProfile({
        baseUrl: "https://api.anthropic.com",
        apiKey: "sk-test-123",
        model: "claude-sonnet-4-20250514",
        timeout: 0,
      });

      const result = await manager.read();
      // 保留其他字段
      expect(result.enabledPlugins).toEqual(["foo"]);
      expect(result.someOtherSetting).toBe("bar");
      // 保留现有 env 字段
      expect(result.env.EXISTING_VAR).toBe("keep-me");
      // 写入新 env 字段
      expect(result.env.ANTHROPIC_AUTH_TOKEN).toBe("sk-test-123");
      expect(result.env.ANTHROPIC_BASE_URL).toBe("https://api.anthropic.com");
      expect(result.env.ANTHROPIC_MODEL).toBe("claude-sonnet-4-20250514");
      expect(result.env.ANTHROPIC_SMALL_FAST_MODEL).toBe("claude-sonnet-4-20250514");
      expect(result.env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe("claude-sonnet-4-20250514");
      expect(result.env.ANTHROPIC_DEFAULT_SONNET_MODEL).toBe("claude-sonnet-4-20250514");
      expect(result.env.ANTHROPIC_DEFAULT_OPUS_MODEL).toBe("claude-sonnet-4-20250514");
      expect(result.env.CLAUDE_CODE_SUBAGENT_MODEL).toBe("claude-sonnet-4-20250514");
      // 不包含旧版平铺字段
      expect(result).not.toHaveProperty("baseUrl");
      expect(result).not.toHaveProperty("apiKey");
      expect(result).not.toHaveProperty("model");
    });

    it("无现有配置时创建 env 字段", async () => {
      await manager.writeProfile({
        baseUrl: "https://api.test.com",
        apiKey: "sk-new",
        model: "test-model",
        timeout: 0,
      });

      const result = await manager.read();
      expect(result.env.ANTHROPIC_AUTH_TOKEN).toBe("sk-new");
      expect(result.env.ANTHROPIC_BASE_URL).toBe("https://api.test.com");
      expect(result.env.ANTHROPIC_MODEL).toBe("test-model");
    });
  });
});
