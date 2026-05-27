import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { BackupManager } from "../../../electron/services/backup-manager";
import { rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

describe("BackupManager", () => {
  let backupManager: BackupManager;
  let testDir: string;
  let settingsDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `cc-tuner-backup-test-${Date.now()}`);
    settingsDir = join(tmpdir(), `cc-tuner-settings-test-${Date.now()}`);
    backupManager = new BackupManager(testDir, settingsDir);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    await rm(settingsDir, { recursive: true, force: true });
  });

  describe("backup()", () => {
    it("备份当前 settings.json 内容", async () => {
      const { writeFile, mkdir } = await import("fs/promises");
      await mkdir(settingsDir, { recursive: true });
      await writeFile(
        join(settingsDir, "settings.json"),
        JSON.stringify({ baseUrl: "https://api.test.com" }),
        "utf-8",
      );
      const record = await backupManager.backup("manual");
      expect(record).not.toBeNull();
      expect(record!.content).toContain("https://api.test.com");
    });

    it("无现有配置时返回 null", async () => {
      const record = await backupManager.backup("manual");
      expect(record).toBeNull();
    });

    it("创建备份记录文件", async () => {
      const { writeFile, mkdir, readdir } = await import("fs/promises");
      await mkdir(settingsDir, { recursive: true });
      await writeFile(
        join(settingsDir, "settings.json"),
        JSON.stringify({ a: 1 }),
        "utf-8",
      );
      await backupManager.backup("manual");
      const files = await readdir(testDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));
      expect(jsonFiles.length).toBe(1);
    });

    it("超过 MAX_BACKUPS 时清理旧备份", async () => {
      const { writeFile, mkdir } = await import("fs/promises");
      await mkdir(settingsDir, { recursive: true });
      await writeFile(
        join(settingsDir, "settings.json"),
        JSON.stringify({ a: 1 }),
        "utf-8",
      );
      // 创建 11 份备份
      for (let i = 0; i < 11; i++) {
        await backupManager.backup("manual");
        await new Promise((r) => setTimeout(r, 10));
      }
      const { readdir } = await import("fs/promises");
      const files = await readdir(testDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));
      expect(jsonFiles.length).toBeLessThanOrEqual(10);
    });
  });

  describe("listBackups()", () => {
    it("返回按时间倒序的备份列表", async () => {
      const { writeFile, mkdir } = await import("fs/promises");
      await mkdir(settingsDir, { recursive: true });
      await writeFile(
        join(settingsDir, "settings.json"),
        JSON.stringify({ a: 1 }),
        "utf-8",
      );
      await backupManager.backup("manual");
      await new Promise((r) => setTimeout(r, 50));
      await backupManager.backup("manual");
      const backups = await backupManager.listBackups();
      expect(backups.length).toBe(2);
      expect(
        new Date(backups[0].timestamp).getTime(),
      ).toBeGreaterThanOrEqual(new Date(backups[1].timestamp).getTime());
    });

    it("无备份时返回空数组", async () => {
      const backups = await backupManager.listBackups();
      expect(backups).toEqual([]);
    });
  });

  describe("restore()", () => {
    it("恢复指定备份到 settings.json", async () => {
      const { writeFile, mkdir } = await import("fs/promises");
      await mkdir(settingsDir, { recursive: true });
      await writeFile(
        join(settingsDir, "settings.json"),
        JSON.stringify({ original: true }),
        "utf-8",
      );
      const record = await backupManager.backup("manual");
      // 修改 settings.json
      await writeFile(
        join(settingsDir, "settings.json"),
        JSON.stringify({ changed: true }),
        "utf-8",
      );
      const restored = await backupManager.restore(record!.id);
      expect(restored).toBe(true);
      const { readFile } = await import("fs/promises");
      const content = JSON.parse(
        await readFile(join(settingsDir, "settings.json"), "utf-8"),
      );
      expect(content.original).toBe(true);
    });

    it("备份不存在时抛出错误", async () => {
      await expect(backupManager.restore("nonexistent-id")).rejects.toThrow();
    });
  });
});
