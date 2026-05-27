import { ipcMain } from "electron";
import { ShellService } from "../services/shell-service";

let shellService: ShellService;

export function registerShellHandlers(ss: ShellService): void {
  shellService = ss;

  ipcMain.handle("shell:open-claude", async () => {
    return shellService.openClaude();
  });

  ipcMain.handle("shell:open-claude-in-dir", async (_event, dir: string) => {
    return shellService.openClaudeInDir(dir);
  });
}
