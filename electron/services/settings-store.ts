import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

const DEFAULT_SETTINGS = {
  configDir: "",
  lastWorkDir: "",
};

export interface AppSettings {
  configDir: string;
  lastWorkDir: string;
}

export class SettingsStore {
  private filePath: string;
  private cache: AppSettings | null = null;

  constructor(userDataDir: string) {
    this.filePath = join(userDataDir, "app-settings.json");
  }

  async load(): Promise<AppSettings> {
    if (this.cache) return this.cache;
    try {
      const raw = await readFile(this.filePath, "utf-8");
      this.cache = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      this.cache = { ...DEFAULT_SETTINGS };
    }
    return this.cache as AppSettings;
  }

  async set(key: keyof AppSettings, value: string): Promise<void> {
    const settings = await this.load();
    settings[key] = value;
    await this.save(settings);
  }

  private async save(settings: AppSettings): Promise<void> {
    await mkdir(join(this.filePath, ".."), { recursive: true }).catch(() => {});
    await writeFile(this.filePath, JSON.stringify(settings, null, 2), "utf-8");
    this.cache = settings;
  }
}
