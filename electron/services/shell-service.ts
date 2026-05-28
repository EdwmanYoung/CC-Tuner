import { exec, execSync } from "child_process";
import { promisify } from "util";
import { platform } from "os";
import { existsSync } from "fs";

const execAsync = promisify(exec);

/** Find git-bash.exe on Windows */
function findGitBash(): string | null {
  // 1. Check common install paths
  const candidates = [
    "C:\\Program Files\\Git\\git-bash.exe",
    "C:\\Program Files (x86)\\Git\\git-bash.exe",
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  // 2. Try to find bash.exe in PATH (Git for Windows adds it)
  try {
    const stdout = execSync("where bash.exe 2>NUL", { encoding: "utf-8" }) as string;
    const lines = stdout.trim().split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && existsSync(trimmed)) return trimmed;
    }
  } catch {
    // Ignore
  }

  return null;
}

export class ShellService {
  /** Open a terminal and run the claude command */
  async openClaude(): Promise<{ ok: boolean; message: string }> {
    return this.openClaudeInDir("");
  }

  /** Open git bash in the given directory and run claude */
  async openClaudeInDir(workDir: string): Promise<{ ok: boolean; message: string }> {
    try {
      const os = platform();

      if (os === "win32") {
        const gitBashPath = findGitBash();

        if (!gitBashPath) {
          return {
            ok: false,
            message: "未找到 Git Bash。请安装 Git for Windows。",
          };
        }

        if (workDir) {
          const escapedDir = workDir.replace(/"/g, '\\"');
          // git-bash.exe -c runs a command and keeps the window open for interactive CLIs
          await execAsync(`"${gitBashPath}" -c "cd '${escapedDir}' && claude"`);
        } else {
          await execAsync(`"${gitBashPath}" -c "claude"`);
        }
      } else if (os === "darwin") {
        const cmd = workDir ? `cd "${workDir}" && claude` : "claude";
        await execAsync(
          `osascript -e 'tell application "Terminal" to do script "${cmd}"'`,
        );
      } else {
        const cmd = workDir ? `cd "${workDir}" && claude` : "claude";
        await execAsync(`x-terminal-emulator -e "${cmd}"`);
      }

      return {
        ok: true,
        message: workDir
          ? `已在 ${workDir} 启动 Claude Code`
          : "Claude Code terminal opened",
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { ok: false, message: `无法启动 Claude Code: ${message}` };
    }
  }
}
