import { ipcMain } from "electron";
import { HistoryManager } from "../services/history-manager";

let historyManager: HistoryManager;

export function registerHistoryHandlers(hm: HistoryManager): void {
  historyManager = hm;

  ipcMain.handle("history:list", async () => {
    return historyManager.list();
  });
}

export function getHistoryManager(): HistoryManager {
  return historyManager;
}
