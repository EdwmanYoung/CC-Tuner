import { ipcMain } from "electron";
import { ProfileManager } from "../services/profile-manager";
import { ConfigManager } from "../services/config-manager";
import { SecurityService } from "../services/security";
import { ValidatorService } from "../services/validator";
import { BackupManager } from "../services/backup-manager";
import { HistoryManager } from "../services/history-manager";

let profileManager: ProfileManager;
let configManager: ConfigManager;
let securityService: SecurityService;
let validatorService: ValidatorService;
let backupManager: BackupManager;
let historyManager: HistoryManager;

export function registerConfigHandlers(
  pm: ProfileManager,
  cm: ConfigManager,
  ss: SecurityService,
  vs: ValidatorService,
  bm: BackupManager,
  hm: HistoryManager,
): void {
  profileManager = pm;
  configManager = cm;
  securityService = ss;
  validatorService = vs;
  backupManager = bm;
  historyManager = hm;

  ipcMain.handle("config:switch", async (_event, id: string) => {
    try {
      const profile = await profileManager.get(id);
      if (!profile) {
        return { success: false, error: { code: "NOT_FOUND" } };
      }

      // Backup current config
      try {
        await backupManager.backup("switch");
      } catch {
        // Non-fatal: continue with switch
      }

      // Decrypt API key
      let apiKey = "";
      if (profile.encryptedApiKey) {
        apiKey = securityService.decrypt(profile.encryptedApiKey);
      }

      // Write to settings.json in env-based format
      await configManager.writeProfile({
        baseUrl: profile.baseUrl,
        apiKey,
        model: profile.model,
        timeout: profile.timeout,
        env: profile.env,
      });

      // Set as active
      await profileManager.setActive(id);

      // Log history
      await historyManager.appendEntry(
        "switch",
        profile.id,
        profile.name,
        `Switched to profile "${profile.name}"`,
      );

      return { success: true, message: `已切换至方案 "${profile.name}"` };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { success: false, error: { code: "SWITCH_FAILED", message } };
    }
  });

  ipcMain.handle("config:test", async (_event, id: string) => {
    try {
      const profile = await profileManager.get(id);
      if (!profile) {
        return { ok: false, message: "Profile not found" };
      }

      let apiKey = "";
      if (profile.encryptedApiKey) {
        apiKey = securityService.decrypt(profile.encryptedApiKey);
      }

      return await validatorService.testConnection(
        profile.baseUrl,
        apiKey,
        profile.model,
        profile.timeout || 10000,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { ok: false, message };
    }
  });

  ipcMain.handle("config:get-current", async () => {
    const profiles = await profileManager.list();
    return profiles.find((p) => p.isActive) ?? null;
  });
}
