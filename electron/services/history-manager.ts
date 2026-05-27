import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { HistoryEntry } from "../../src/types";

const MAX_ENTRIES = 500;

export class HistoryManager {
  private dataDir: string;
  private filePath: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.filePath = join(dataDir, "cc-tuner-history.json");
  }

  /** Append a new history entry */
  async appendEntry(
    action: HistoryEntry["action"],
    profileId: string,
    profileName: string | undefined,
    details: string,
  ): Promise<void> {
    const entries = await this.list();
    const entry: HistoryEntry = {
      id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      timestamp: new Date().toISOString(),
      action,
      profileId,
      profileName,
      details,
    };

    entries.push(entry);

    // Keep only last MAX_ENTRIES
    const trimmed = entries.slice(-MAX_ENTRIES);
    await this.save(trimmed);
  }

  /** List all history entries */
  async list(): Promise<HistoryEntry[]> {
    try {
      const content = await readFile(this.filePath, "utf-8");
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  /** Clear all history */
  async clear(): Promise<void> {
    await this.save([]);
  }

  private async save(entries: HistoryEntry[]): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    await writeFile(this.filePath, JSON.stringify(entries, null, 2), "utf-8");
  }
}
