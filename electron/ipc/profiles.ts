import { ipcMain } from "electron";
import { ProfileManager } from "../services/profile-manager";
import { SecurityService } from "../services/security";
import { HistoryManager } from "../services/history-manager";

let profileManager: ProfileManager;
let securityService: SecurityService;
let historyManager: HistoryManager;

export function registerProfileHandlers(
  pm: ProfileManager,
  ss: SecurityService,
  hm: HistoryManager,
): void {
  profileManager = pm;
  securityService = ss;
  historyManager = hm;

  ipcMain.handle("profiles:list", async () => {
    return profileManager.list();
  });

  ipcMain.handle("profiles:create", async (_event, input) => {
    if (!input.name || typeof input.name !== "string" || input.name.trim() === "") {
      return { success: false, error: { code: "VALIDATION_ERROR" } };
    }

    // Encrypt API key
    const encryptedKey = input.apiKey
      ? securityService.encrypt(input.apiKey)
      : undefined;

    const profile = await profileManager.create({
      name: input.name,
      provider: input.provider,
      baseUrl: input.baseUrl,
      encryptedApiKey: encryptedKey,
      model: input.model,
      timeout: input.timeout,
      notes: input.notes,
      env: input.env,
    });

    await historyManager.appendEntry(
      "create",
      profile.id,
      profile.name,
      `Created profile "${profile.name}" (${profile.provider})`,
    );

    return { success: true, data: profile };
  });

  ipcMain.handle("profiles:update", async (_event, id, updates) => {
    const existing = await profileManager.get(id);
    if (!existing) {
      return { success: false, error: { code: "NOT_FOUND" } };
    }

    const profileInput: Record<string, unknown> = {};
    if (updates.name !== undefined) profileInput.name = updates.name;
    if (updates.provider !== undefined) profileInput.provider = updates.provider;
    if (updates.baseUrl !== undefined) profileInput.baseUrl = updates.baseUrl;
    if (updates.model !== undefined) profileInput.model = updates.model;
    if (updates.timeout !== undefined) profileInput.timeout = updates.timeout;
    if (updates.notes !== undefined) profileInput.notes = updates.notes;
    if (updates.env !== undefined) profileInput.env = updates.env;

    if (updates.apiKey) {
      profileInput.encryptedApiKey = securityService.encrypt(updates.apiKey);
    }

    const updated = await profileManager.update(id, profileInput);
    if (!updated) {
      return { success: false, error: { code: "NOT_FOUND" } };
    }

    await historyManager.appendEntry(
      "update",
      updated.id,
      updated.name,
      `Updated profile "${updated.name}"`,
    );

    return { success: true, data: updated };
  });

  ipcMain.handle("profiles:delete", async (_event, id) => {
    const profile = await profileManager.get(id);
    const result = await profileManager.delete(id);

    if (result && profile) {
      await historyManager.appendEntry(
        "delete",
        id,
        profile.name,
        `Deleted profile "${profile.name}"`,
      );
    }

    return result;
  });
}

export function getProfileManager(): ProfileManager {
  return profileManager;
}
