// IPC communication wrapper

const api = window.api;

export async function listProfiles() {
  return api.profiles.list();
}

export async function createProfile(input) {
  return api.profiles.create(input);
}

export async function updateProfile(id, updates) {
  return api.profiles.update(id, updates);
}

export async function deleteProfile(id) {
  return api.profiles.delete(id);
}

export async function switchProfile(id) {
  return api.config.switch(id);
}

export async function testConnection(id) {
  return api.config.test(id);
}

export async function getCurrentProfile() {
  return api.config.getCurrent();
}

export async function listBackups() {
  return api.backup.list();
}

export async function restoreBackup(id) {
  return api.backup.restore(id);
}

export async function createBackup() {
  return api.backup.create();
}

export async function listHistory() {
  return api.history.list();
}

export async function openClaude() {
  return api.shell.openClaude();
}

export async function openClaudeInDir(dir) {
  return api.shell.openClaudeInDir(dir);
}

export async function selectDirectory(title) {
  const result = await api.dialog.selectDirectory({ title });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
}

/** Select config directory (auto-saves after selection) */
export async function selectConfigDir() {
  return api.dialog.selectConfigDir();
}

export async function getConfigDir() {
  return api.settings.getConfigDir();
}

export async function setConfigDir(dir) {
  return api.settings.setConfigDir(dir);
}

export async function encryptionAvailable() {
  return api.system.encryptionAvailable();
}

export async function getVersion() {
  return api.system.getVersion();
}

function _winCall(method) {
  if (!api?.win?.[method]) {
    console.error(`[WindowCtrl] api.win.${method} not available — preload may not be loaded`);
    return;
  }
  return api.win[method]();
}

export function windowMinimize() { return _winCall("minimize"); }
export function windowMaximize() { return _winCall("maximize"); }
export function windowClose()    { return _winCall("close"); }
export function windowIsMaximized() { return _winCall("isMaximized"); }
