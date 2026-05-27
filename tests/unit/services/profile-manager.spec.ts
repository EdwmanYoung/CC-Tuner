import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ProfileManager } from "../../../electron/services/profile-manager";
import { rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { Provider } from "../../../src/types";

describe("ProfileManager", () => {
  let manager: ProfileManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `cc-tuner-profile-test-${Date.now()}`);
    manager = new ProfileManager(testDir);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe("list()", () => {
    it("返回空数组当文件不存在", async () => {
      const result = await manager.list();
      expect(result).toEqual([]);
    });

    it("正确读取 profiles.json", async () => {
      await manager.create({
        name: "Test",
        provider: Provider.Anthropic,
        baseUrl: "https://api.test.com",
        encryptedApiKey: "encrypted",
        model: "test-model",
        timeout: 0,
      });
      const result = await manager.list();
      expect(result.length).toBe(1);
      expect(result[0].name).toBe("Test");
    });
  });

  describe("create()", () => {
    it("创建 Profile 并分配 UUID", async () => {
      const profile = await manager.create({
        name: "测试方案",
        provider: Provider.Anthropic,
        baseUrl: "https://api.test.com",
        encryptedApiKey: "encrypted-key",
        model: "test-model",
        timeout: 0,
      });
      expect(profile.id).toBeDefined();
      expect(typeof profile.id).toBe("string");
      expect(profile.id.length).toBeGreaterThan(0);
    });

    it("新 Profile isActive 为 false", async () => {
      const profile = await manager.create({
        name: "New Profile",
        provider: Provider.Anthropic,
        baseUrl: "https://api.test.com",
        encryptedApiKey: "key",
        model: "model",
        timeout: 0,
      });
      expect(profile.isActive).toBe(false);
    });

    it("设置 createdAt 和 updatedAt", async () => {
      const profile = await manager.create({
        name: "Timestamped",
        provider: Provider.Anthropic,
        baseUrl: "https://api.test.com",
        encryptedApiKey: "key",
        model: "model",
        timeout: 0,
      });
      expect(profile.createdAt).toBeDefined();
      expect(profile.updatedAt).toBeDefined();
      expect(new Date(profile.createdAt).getTime()).toBeGreaterThan(0);
      expect(new Date(profile.updatedAt).getTime()).toBeGreaterThan(0);
    });
  });

  describe("update()", () => {
    it("更新字段并刷新 updatedAt", async () => {
      const profile = await manager.create({
        name: "Original",
        provider: Provider.Anthropic,
        baseUrl: "https://api.test.com",
        encryptedApiKey: "key",
        model: "model",
        timeout: 0,
      });
      const beforeUpdate = profile.updatedAt;

      await new Promise((r) => setTimeout(r, 10)); // 确保时间戳不同

      const updated = await manager.update(profile.id, { name: "Updated" });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe("Updated");
      expect(updated!.updatedAt).not.toBe(beforeUpdate);
    });

    it("返回 null 当 Profile 不存在", async () => {
      const result = await manager.update("nonexistent-id", { name: "Nope" });
      expect(result).toBeNull();
    });
  });

  describe("delete()", () => {
    it("删除成功返回 true", async () => {
      const profile = await manager.create({
        name: "ToDelete",
        provider: Provider.Anthropic,
        baseUrl: "https://api.test.com",
        encryptedApiKey: "key",
        model: "model",
        timeout: 0,
      });
      const result = await manager.delete(profile.id);
      expect(result).toBe(true);
      const remaining = await manager.list();
      expect(remaining.length).toBe(0);
    });

    it("删除不存在的返回 false", async () => {
      const result = await manager.delete("nonexistent-id");
      expect(result).toBe(false);
    });
  });

  describe("get()", () => {
    it("按 ID 获取 Profile", async () => {
      const profile = await manager.create({
        name: "FindMe",
        provider: Provider.Anthropic,
        baseUrl: "https://api.test.com",
        encryptedApiKey: "key",
        model: "model",
        timeout: 0,
      });
      const found = await manager.get(profile.id);
      expect(found).not.toBeNull();
      expect(found!.name).toBe("FindMe");
    });

    it("不存在时返回 null", async () => {
      const result = await manager.get("nonexistent-id");
      expect(result).toBeNull();
    });
  });

  describe("setActive()", () => {
    it("只设置一个为激活状态", async () => {
      const p1 = await manager.create({
        name: "A",
        provider: Provider.Anthropic,
        baseUrl: "https://api.test.com",
        encryptedApiKey: "key",
        model: "model",
        timeout: 0,
      });
      const p2 = await manager.create({
        name: "B",
        provider: Provider.Anthropic,
        baseUrl: "https://api.test.com",
        encryptedApiKey: "key",
        model: "model",
        timeout: 0,
      });
      await manager.setActive(p2.id);
      const profiles = await manager.list();
      expect(profiles.find((p) => p.id === p1.id)!.isActive).toBe(false);
      expect(profiles.find((p) => p.id === p2.id)!.isActive).toBe(true);
    });

    it("保存后持久化", async () => {
      const p1 = await manager.create({
        name: "A",
        provider: Provider.Anthropic,
        baseUrl: "https://api.test.com",
        encryptedApiKey: "key",
        model: "model",
        timeout: 0,
      });
      await manager.setActive(p1.id);
      // 新建一个 manager 实例模拟重新读取
      const manager2 = new ProfileManager(testDir);
      const profiles = await manager2.list();
      expect(profiles.find((p) => p.id === p1.id)!.isActive).toBe(true);
    });
  });
});
