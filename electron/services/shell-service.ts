import { exec, execSync, spawn } from "child_process";
import { promisify } from "util";
import { platform } from "os";
import { existsSync } from "fs";

const execAsync = promisify(exec);

/** Find git-bash.exe on Windows */
function findGitBash(): string | null {
  const candidates = [
    "C:\\Program Files\\Git\\git-bash.exe",
    "C:\\Program Files (x86)\\Git\\git-bash.exe",
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  // Try to find bash.exe in PATH
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

/** Check if claude CLI is available in PATH */
function findClaudeCli(): boolean {
  try {
    execSync("where claude 2>NUL", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export class ShellService {
  async openClaude(): Promise<{ ok: boolean; message: string }> {
    return this.openClaudeInDir("");
  }

  async openClaudeInDir(workDir: string): Promise<{ ok: boolean; message: string }> {
    try {
      const os = platform();

      if (os === "win32") {
        return this._openClaudeWindows(workDir);
      } else if (os === "darwin") {
        const cmd = workDir ? `cd "${workDir}" && claude` : "claude";
        await execAsync(
          `osascript -e 'tell application "Terminal" to do script "${cmd}"'`,
        );
        return {
          ok: true,
          message: workDir ? `已在 ${workDir} 启动 Claude Code` : "Claude Code terminal opened",
        };
      } else {
        const cmd = workDir ? `cd "${workDir}" && claude` : "claude";
        await execAsync(`x-terminal-emulator -e "${cmd}"`);
        return {
          ok: true,
          message: workDir ? `已在 ${workDir} 启动 Claude Code` : "Claude Code terminal opened",
        };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { ok: false, message: `无法启动 Claude Code: ${message}` };
    }
  }

  /** Windows-specific Claude launch with fallback chain */
  private async _openClaudeWindows(workDir: string): Promise<{ ok: boolean; message: string }> {
    const hasClaude = findClaudeCli();
    if (!hasClaude) {
      return {
        ok: false,
        message:
          "未找到 claude 命令。请确保已安装 Claude Code CLI（运行 `npm install -g @anthropic-ai/claude-code`）。",
      };
    }

    const cwd = workDir || process.cwd();
    const gitBashPath = findGitBash();

    if (!gitBashPath) {
      // Fallback: plain cmd.exe window
      spawn("cmd.exe", ["/c", "start", "Claude Code", "cmd", "/k", `cd /d "${cwd}" && claude`], {
        detached: true,
        stdio: "ignore",
        windowsHide: false,
      }).unref();
      return {
        ok: true,
        message: workDir ? `已在 ${workDir} 启动 Claude Code` : "Claude Code terminal opened",
      };
    }

    // Git Bash: use `cmd /c start` to open a visible window, --cd to enter
    // the work directory, then winpty to bridge mintty with claude's TUI.
    // winpty is bundled with Git for Windows (usr/bin/winpty.exe).
    const gitRoot = gitBashPath.replace(/\\git-bash\.exe$/, "");
    const winptyPath = `${gitRoot}\\usr\\bin\\winpty.exe`;
    const winptyCmd = existsSync(winptyPath) ? `"${winptyPath}"` : "winpty";
    const bashDir = workDir ? `--cd="${workDir}"` : "";

    const startCmd = `start "" "${gitBashPath}" ${bashDir} -c "${winptyCmd} claude"`;
    spawn("cmd.exe", ["/c", startCmd], {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    }).unref();

    return {
      ok: true,
      message: workDir ? `已在 ${workDir} 启动 Claude Code (Git Bash)` : "Claude Code terminal opened (Git Bash)",
    };
  }
}
