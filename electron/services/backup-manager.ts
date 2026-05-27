import { readFile, writeFile, mkdir, readdir, rm } from "fs/promises";
import { join } from "path";
import { BackupRecord } from "../../src/types";

export class BackupManager {
  private backupDir: string;
  private settingsDir: string;
  private readonly MAX_BACKUPS = 10;

  constructor(backupDir: string, settingsDir: string) {
    this.backupDir = backupDir;
    this.settingsDir = settingsDir;
  }

  /** Create a backup of current settings.json */
  async backup(trigger: "switch" | "manual"): Promise<BackupRecord | null> {
    let content: string;
    try {
      content = await readFile(
        join(this.settingsDir, "settings.json"),
        "utf-8",
      );
    } catch {
      return null; // No existing config to backup
    }

    await mkdir(this.backupDir, { recursive: true });

    const record: BackupRecord = {
      id: `backup-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      timestamp: new Date().toISOString(),
      content,
      trigger,
    };

    await writeFile(
      join(this.backupDir, `${record.id}.json`),
      JSON.stringify(record, null, 2),
      "utf-8",
    );

    // Clean old backups if exceeding limit
    await this.cleanOldBackups();

    return record;
  }

  /** List all backups sorted newest-first */
  async listBackups(): Promise<BackupRecord[]> {
    const files = await this.listBackupFiles();
    const backups: BackupRecord[] = [];

    for (const file of files) {
      try {
        const content = await readFile(
          join(this.backupDir, file),
          "utf-8",
        );
        backups.push(JSON.parse(content));
      } catch {
        // Skip corrupted backup files
      }
    }

    return backups.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }

  /** Restore a specific backup to settings.json */
  async restore(backupId: string): Promise<boolean> {
    const backupPath = join(this.backupDir, `${backupId}.json`);
    const content = await readFile(backupPath, "utf-8");
    const record: BackupRecord = JSON.parse(content);

    await writeFile(
      join(this.settingsDir, "settings.json"),
      record.content,
      "utf-8",
    );

    return true;
  }

  /** Clean old backups exceeding MAX_BACKUPS */
  private async cleanOldBackups(): Promise<void> {
    const files = await this.listBackupFiles();
    if (files.length <= this.MAX_BACKUPS) return;

    // Sort by filename (contains timestamp), delete oldest
    files.sort();
    const toDelete = files.slice(0, files.length - this.MAX_BACKUPS);
    for (const file of toDelete) {
      await rm(join(this.backupDir, file));
    }
  }

  private async listBackupFiles(): Promise<string[]> {
    try {
      const files = await readdir(this.backupDir);
      return files.filter((f) => f.endsWith(".json"));
    } catch {
      return [];
    }
  }
}
