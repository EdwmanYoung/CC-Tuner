import { exec } from "child_process";
import { promisify } from "util";
import { platform } from "os";

const execAsync = promisify(exec);

export class ShellService {
  /** Open a terminal and run the claude command */
  async openClaude(): Promise<{ ok: boolean; message: string }> {
    return this.openClaudeInDir("");
  }

  /** Open git bash in the given directory and run claude */
  async openClaudeInDir(workDir: string): Promise<{ ok: boolean; message: string }> {
    try {
      const os = platform();
      const dirArg = workDir ? ` --cd="${workDir.replace(/"/g, '\\"')}"` : "";
      if (os === "win32") {
        await execAsync(`start "" "git-bash"${dirArg} -c "claude"`);
      } else if (os === "darwin") {
        const cmd = workDir ? `cd "${workDir}" && claude` : "claude";
        await execAsync(
          `osascript -e 'tell application "Terminal" to do script "${cmd}"'`,
        );
      } else {
        const cmd = workDir ? `cd "${workDir}" && claude` : "claude";
        await execAsync(`x-terminal-emulator -e "${cmd}"`);
      }
      return { ok: true, message: workDir ? `已在 ${workDir} 启动 Claude Code` : "Claude Code terminal opened" };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { ok: false, message: `Failed to open Claude Code: ${message}` };
    }
  }
}
