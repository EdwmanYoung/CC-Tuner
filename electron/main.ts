import { app, BrowserWindow } from "electron";
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
    },
  });

  mainWindow.webContents.on("did-fail-load", (_event, code, desc) => {
    console.error(`[Main] Page failed to load: ${code} - ${desc}`);
  });

  mainWindow.webContents.on("crashed", () => {
    console.error("[Main] Renderer crashed");
  });

  if (process.env.NODE_ENV === "development" || !app.isPackaged) {
    console.log("[Main] Loading dev URL: http://localhost:4322");
    mainWindow.loadURL("http://localhost:4322");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, "../dist/index.html"));
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

let settingsStore: SettingsStore;

async function initializeServices(): Promise<void> {
  const userDataPath = app.getPath("userData");
  settingsStore = new SettingsStore(userDataPath);
  const configDir = await getConfigDir();

  const profileManager = new ProfileManager(userDataPath);
  const configManager = new ConfigManager(configDir);
  const securityService = new SecurityService();
  const validatorService = new ValidatorService();
  const backupManager = new BackupManager(
    join(userDataPath, "backups"),
    configDir,
  );
  const shellService = new ShellService();
  const historyManager = new HistoryManager(userDataPath);

  console.log(`[Config] Config directory: ${configDir || "(none)"}`);
  console.log(`[Config] User data path: ${userDataPath}`);

  registerIpcHandlers(
    profileManager,
    configManager,
    securityService,
    validatorService,
    backupManager,
    shellService,
    historyManager,
  );

  // Settings & dialog IPC handlers
  const { ipcMain, dialog } = require("electron");

  ipcMain.handle("settings:get-config-dir", async () => {
    const s = await settingsStore.load();
    return s.configDir;
  });

  ipcMain.handle("settings:set-config-dir", async (_event: unknown, dir: string) => {
    await settingsStore.set("configDir", dir);
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
    return result;
  });

  // System IPC handlers
  ipcMain.handle("system:encryption-available", () =>
    securityService.isEncryptionAvailable(),
  );
  ipcMain.handle("system:get-version", () => app.getVersion());
}

async function getConfigDir(): Promise<string> {
  const saved = await settingsStore.load();
  if (saved.configDir && existsSync(saved.configDir)) {
    console.log(`[Config] Using saved config directory: ${saved.configDir}`);
    return saved.configDir;
  }
  return "";
}

app.whenReady().then(async () => {
  await initializeServices();
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
