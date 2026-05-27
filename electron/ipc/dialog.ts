import { ipcMain, dialog, BrowserWindow } from "electron";

export function registerDialogHandlers(): void {
  ipcMain.handle("dialog:select-directory", async (_event, options: { title?: string }) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return { canceled: true, filePaths: [] };

    const result = await dialog.showOpenDialog(win, {
      title: options.title || "选择目录",
      properties: ["openDirectory"],
    });
    return result;
  });
}
