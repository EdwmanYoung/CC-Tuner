// App entry point
console.log("[Renderer] app.js loaded");
import { get, set } from "./state.js";
import { initSidebar, navigateTo, renderProfilesPage, renderHistoryPage, renderSettingsPage, showEditorPage, showDetailPage, loadProfiles } from "./renderers.js";
import { initTheme, toggleTheme } from "./theme.js";
import { show } from "./toaster.js";
import * as api from "./api.js";

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  // Window controls
  const maximizeBtn = document.querySelector('[data-action="maximize"]');

  document.querySelectorAll(".win-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.action;
      if (action === "minimize") await api.windowMinimize();
      else if (action === "maximize") {
        await api.windowMaximize();
        updateMaximizeIcon();
      }
      else if (action === "close") await api.windowClose();
    });
  });

  // Update maximize button icon based on window state
  async function updateMaximizeIcon() {
    const isMax = await api.windowIsMaximized();
    const svgIcon = isMax
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="18" height="18" rx="2"/><rect x="0" y="0" width="18" height="18" rx="2"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>';
    maximizeBtn.innerHTML = svgIcon;
  }

  // Theme
  initTheme();
  document.getElementById("themeToggle").addEventListener("click", () => {
    toggleTheme();
  });

  // Sidebar navigation
  initSidebar((page) => {
    navigateTo(page);
    if (page === "profiles") renderProfilesPage();
    else if (page === "history") renderHistoryPage();
    else if (page === "settings") renderSettingsPage();
  });

  // Search
  document.getElementById("searchInput").addEventListener("input", (e) => {
    set("searchQuery", e.target.value);
    renderProfilesPage();
  });

  // New profile button
  document.getElementById("newProfileBtn").addEventListener("click", () => {
    showEditorPage(null);
  });

  // Launch Claude Code — let user pick working directory
  document.getElementById("launchClaudeBtn").addEventListener("click", async () => {
    const dir = await api.selectDirectory("选择 Claude Code 工作目录");
    if (!dir) return;

    const result = await api.openClaudeInDir(dir);
    if (result.ok) {
      show("success", result.message);
    } else {
      show("error", result.message);
    }
  });

  // Setup dialog: configure button
  document.getElementById("setupConfigBtn").addEventListener("click", async () => {
    const result = await api.selectConfigDir();
    if (result && !result.canceled && result.filePaths.length > 0) {
      const dir = result.filePaths[0];
      await api.setConfigDir(dir);
      show("success", "配置目录已设置，已加载现有配置");
      hideSetupOverlay();
      await loadConfigDir();
      await loadProfiles();
    }
  });

  // Setup dialog: skip button
  document.getElementById("setupSkipBtn").addEventListener("click", () => {
    hideSetupOverlay();
  });

  // Load config dir info and profiles
  initSetupCheck();
  loadProfiles();
});

/** Check if config dir is set, show setup overlay if not */
async function initSetupCheck() {
  const configDir = await api.getConfigDir();
  if (!configDir) {
    showSetupOverlay();
  } else {
    hideSetupOverlay();
    set("configDir", configDir);
    const el = document.getElementById("configDirPath");
    if (el) el.textContent = configDir;
  }
}

function showSetupOverlay() {
  document.getElementById("setupOverlay").classList.remove("hidden");
}

function hideSetupOverlay() {
  document.getElementById("setupOverlay").classList.add("hidden");
}

async function loadConfigDir() {
  const configDir = await api.getConfigDir();
  const el = document.getElementById("configDirPath");
  if (el) {
    el.textContent = configDir || "未设置";
  }
  set("configDir", configDir);
}
