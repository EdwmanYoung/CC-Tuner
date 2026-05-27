import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  // Profile CRUD
  profiles: {
    list: () => ipcRenderer.invoke("profiles:list"),
    create: (input: unknown) => ipcRenderer.invoke("profiles:create", input),
    update: (id: string, updates: unknown) =>
      ipcRenderer.invoke("profiles:update", id, updates),
    delete: (id: string) => ipcRenderer.invoke("profiles:delete", id),
  },

  // Config operations
  config: {
    switch: (id: string) => ipcRenderer.invoke("config:switch", id),
    test: (id: string) => ipcRenderer.invoke("config:test", id),
    getCurrent: () => ipcRenderer.invoke("config:get-current"),
  },

  // Backup
  backup: {
    list: () => ipcRenderer.invoke("backup:list"),
    restore: (id: string) => ipcRenderer.invoke("backup:restore", id),
    restoreLatest: () => ipcRenderer.invoke("backup:restore-latest"),
    create: () => ipcRenderer.invoke("backup:create"),
  },

  // Shell
  shell: {
    openClaude: () => ipcRenderer.invoke("shell:open-claude"),
    openClaudeInDir: (dir: string) => ipcRenderer.invoke("shell:open-claude-in-dir", dir),
  },

  // History
  history: {
    list: () => ipcRenderer.invoke("history:list"),
  },

  // Settings
  settings: {
    getConfigDir: () => ipcRenderer.invoke("settings:get-config-dir"),
    setConfigDir: (dir: string) => ipcRenderer.invoke("settings:set-config-dir", dir),
  },

  // Dialog
  dialog: {
    selectDirectory: (options: { title?: string }) =>
      ipcRenderer.invoke("dialog:select-directory", options),
    selectConfigDir: () =>
      ipcRenderer.invoke("dialog:select-config-dir"),
  },

  // System
  system: {
    encryptionAvailable: () => ipcRenderer.invoke("system:encryption-available"),
    getVersion: () => ipcRenderer.invoke("system:get-version"),
  },
});
