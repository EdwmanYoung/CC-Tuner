import { ipcMain } from "electron";
import { BackupManager } from "../services/backup-manager";

let backupManager: BackupManager;

export function registerBackupHandlers(bm: BackupManager): void {
  backupManager = bm;

  ipcMain.handle("backup:list", async () => {
    const backups = await backupManager.listBackups();
    return backups.map(({ content, ...summary }) => summary);
  });

  ipcMain.handle("backup:restore", async (_event, id: string) => {
    return backupManager.restore(id);
  });

  ipcMain.handle("backup:restore-latest", async () => {
    const backups = await backupManager.listBackups();
    if (backups.length === 0) return false;
    return backupManager.restore(backups[0].id);
  });

  ipcMain.handle("backup:create", async () => {
    const result = await backupManager.backup("manual");
    return result !== null;
  });
}
