import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { join } from "path";
import { existsSync } from "fs";
import {
  ProfileManager,
  ConfigManager,
  SecurityService,
  ValidatorService,
  BackupManager,
  ShellService,
  HistoryManager,
  SettingsStore,
} from "./services";
import { registerIpcHandlers } from "./ipc";

let mainWindow: BrowserWindow | null = null;
let settingsStore: SettingsStore;

// Service instances (re-created when config dir changes)
let profileManager: ProfileManager | null = null;
let configManager: ConfigManager | null = null;
let securityService: SecurityService | null = null;
let validatorService: ValidatorService | null = null;
let backupManager: BackupManager | null = null;
let shellService: ShellService | null = null;
let historyManager: HistoryManager | null = null;

function createWindow(): void {
  console.log("[Main] Creating BrowserWindow...");
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  mainWindow.webContents.on("did-fail-load", (_event, code, desc) => {
    console.error(`[Main] Page failed to load: ${code} - ${desc}`);
  });

  mainWindow.webContents.on("did-finish-load", () => {
    console.log("[Main] Page finished loading");
  });

  mainWindow.webContents.on("dom-ready", () => {
    console.log("[Main] DOM ready");
  });

  mainWindow.webContents.on("crashed", () => {
    console.error("[Main] Renderer crashed");
  });

  mainWindow.webContents.on("console-message", (_event, level, message) => {
    const prefix = ["VERBOSE", "INFO", "WARN", "ERROR"][level] || "LOG";
    console.log(`[Renderer ${prefix}] ${message}`);
  });

  if (process.env.NODE_ENV === "development" || !app.isPackaged) {
    console.log("[Main] Loading dev URL: http://localhost:4322");
    mainWindow.loadURL("http://localhost:4322");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, "../../dist/index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    console.log("[Main] Window ready-to-show");
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    console.log("[Main] Window closed");
    mainWindow = null;
  });
}

async function getConfigDir(): Promise<string> {
  const saved = await settingsStore.load();
  if (saved.configDir && existsSync(saved.configDir)) {
    console.log(`[Config] Using saved config directory: ${saved.configDir}`);
    return saved.configDir;
  }
  return "";
}

/**
 * Read existing settings.json and create an initial "默认配置" profile
 * if no profiles exist yet.
 */
async function importInitialProfile(configDir: string): Promise<void> {
  if (!configDir || !profileManager || !configManager || !securityService || !historyManager) {
    return;
  }

  // Only import if no profiles exist yet
  const existing = await profileManager.list();
  if (existing.length > 0) {
    console.log("[Config] Profiles already exist, skipping auto-import");
    return;
  }

  // Read settings.json and extract env
  const profile = await configManager.extractProfile();
  if (!profile.hasConfig) {
    console.log("[Config] settings.json has no env content, skipping auto-import");
    return;
  }

  // Extract key fields for the profile
  const env = profile.env;
  const model = env["ANTHROPIC_MODEL"] || "";
  const baseUrl = env["ANTHROPIC_BASE_URL"] || "";
  const apiKey = env["ANTHROPIC_AUTH_TOKEN"] || "";

  if (!model && !baseUrl) {
    console.log("[Config] No model/baseUrl found in settings.json, skipping auto-import");
    return;
  }

  // Encrypt API key
  const encryptedKey = apiKey ? securityService.encrypt(apiKey) : undefined;

  // Create initial profile
  const created = await profileManager.create({
    name: "默认配置",
    provider: "custom",
    baseUrl: baseUrl || "https://api.anthropic.com",
    encryptedApiKey: encryptedKey,
    model: model || "claude-sonnet-4-20250514",
    timeout: 0,
    env: env,
  });

  // Set as active
  await profileManager.setActive(created.id);

  // Log history
  await historyManager.appendEntry(
    "create",
    created.id,
    created.name,
    `Auto-imported from existing settings.json`,
  );

  console.log(`[Config] Auto-imported initial profile "${created.name}" from settings.json`);
}

/**
 * Initialize or re-initialize all config-dependent services.
 * Called on startup and when config dir changes.
 */
async function initConfigServices(configDir: string): Promise<void> {
  const userDataPath = app.getPath("userData");

  profileManager = new ProfileManager(userDataPath);
  configManager = new ConfigManager(configDir);
  securityService = new SecurityService();
  validatorService = new ValidatorService();
  backupManager = new BackupManager(
    join(userDataPath, "backups"),
    configDir,
  );
  shellService = new ShellService();
  historyManager = new HistoryManager(userDataPath);

  console.log(`[Config] Config directory: ${configDir || "(none)"}`);
  console.log(`[Config] User data path: ${userDataPath}`);

  // Auto-import initial profile from settings.json
  await importInitialProfile(configDir);

  // Register all IPC handlers
  registerIpcHandlers(
    profileManager,
    configManager,
    securityService,
    validatorService,
    backupManager,
    shellService,
    historyManager,
  );

  registerSystemIpcHandlers();
}

function registerSystemIpcHandlers(): void {
  ipcMain.removeHandler("settings:get-config-dir");
  ipcMain.removeHandler("settings:set-config-dir");
  ipcMain.removeHandler("dialog:select-config-dir");
  ipcMain.removeHandler("window:minimize");
  ipcMain.removeHandler("window:maximize");
  ipcMain.removeHandler("window:close");

  ipcMain.handle("settings:get-config-dir", async () => {
    const s = await settingsStore.load();
    return s.configDir;
  });

  ipcMain.handle("settings:set-config-dir", async (_event: unknown, dir: string) => {
    await settingsStore.set("configDir", dir);
    await initConfigServices(dir);
    return true;
  });

  ipcMain.handle("dialog:select-config-dir", async () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow;
    if (!win) return { canceled: true, filePaths: [] };

    const result = await dialog.showOpenDialog(win, {
      title: "选择 Claude Code 配置目录",
      properties: ["openDirectory"],
      message: "请选择包含 .claude/settings.json 的项目根目录",
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, filePaths: [] };
    }

    const selectedDir = result.filePaths[0];
    await settingsStore.set("configDir", selectedDir);
    console.log(`[Config] Selected config directory: ${selectedDir}`);

    // Re-init services with new config dir
    await initConfigServices(selectedDir);

    return result;
  });

  ipcMain.handle("system:encryption-available", () =>
    securityService?.isEncryptionAvailable() ?? false,
  );
  ipcMain.handle("system:get-version", () => app.getVersion());

  // Window controls
  ipcMain.handle("window:minimize", () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow;
    win?.minimize();
  });

  ipcMain.handle("window:maximize", () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow;
    if (!win) return;
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.handle("window:close", () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow;
    win?.close();
  });

  ipcMain.handle("window:is-maximized", () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow;
    return win?.isMaximized() ?? false;
  });
}

app.whenReady().then(async () => {
  const userDataPath = app.getPath("userData");
  settingsStore = new SettingsStore(userDataPath);

  const configDir = await getConfigDir();
  await initConfigServices(configDir);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  console.log("[Main] All windows closed, quitting");
  if (process.platform !== "darwin") {
    app.quit();
  }
});

process.on("uncaughtException", (err) => {
  console.error("[Main] Uncaught exception:", err);
});

app.on("render-process-gone", (_event, wc, details) => {
  console.error(`[Main] Render process gone: ${details.reason}`);
});
