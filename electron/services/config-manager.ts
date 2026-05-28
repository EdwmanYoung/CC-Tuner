import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { ClaudeSettings } from "../../src/types";

/** Core profile fields for writing to settings.json env */
export interface ProfileCore {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeout: number;
  env?: Record<string, string>;
}

/** Profile data extracted from settings.json */
export interface ExtractedProfile {
  env: Record<string, string>;
  enabledPlugins: Record<string, boolean>;
  hasConfig: boolean;
}

export class ConfigManager {
  private configDir: string;

  constructor(configDir: string) {
    this.configDir = configDir;
  }

  /** Check if settings.json exists in the config directory */
  hasConfigFile(): boolean {
    if (!this.configDir) return false;
    return existsSync(join(this.configDir, "settings.json"));
  }

  /** Read settings.json, return empty object if not found or invalid */
  async read(): Promise<Record<string, unknown>> {
    try {
      const content = await readFile(
        join(this.configDir, "settings.json"),
        "utf-8",
      );
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  /** Extract env and other fields from settings.json as a profile snapshot */
  async extractProfile(): Promise<ExtractedProfile> {
    const settings = await this.read();
    if (Object.keys(settings).length === 0) {
      return { env: {}, enabledPlugins: {}, hasConfig: false };
    }

    const env = (settings.env as Record<string, string>) || {};
    const enabledPlugins = (settings.enabledPlugins as Record<string, boolean>) || {};

    return { env, enabledPlugins, hasConfig: Object.keys(env).length > 0 };
  }

  /** Write data to settings.json with 2-space indent */
  async write(data: Record<string, unknown>): Promise<void> {
    await mkdir(this.configDir, { recursive: true });
    await writeFile(
      join(this.configDir, "settings.json"),
      JSON.stringify(data, null, 2),
      "utf-8",
    );
  }

  /** Convert a Profile to settings.json format (legacy flat format, for tests) */
  profileToSettings(profile: ProfileCore): Record<string, unknown> {
    const settings: Record<string, unknown> = {
      baseUrl: profile.baseUrl,
      apiKey: profile.apiKey,
      model: profile.model,
    };
    if (profile.timeout > 0) {
      settings.timeout = profile.timeout;
    }
    return settings;
  }

  /**
   * Write profile to settings.json in env-based format.
   * Reads existing settings → replaces env with profile's env → cleans legacy flat fields → writes back.
   * Preserves non-env fields like enabledPlugins.
   */
  async writeProfile(profile: ProfileCore): Promise<void> {
    const existing = await this.read();
    const merged: Record<string, unknown> = { ...existing };

    // Ensure env object exists
    if (typeof merged.env !== "object" || merged.env === null || Array.isArray(merged.env)) {
      merged.env = {};
    }
    const env = merged.env as Record<string, string>;

    // If profile has full env object, use it directly
    if (profile.env && Object.keys(profile.env).length > 0) {
      merged.env = { ...profile.env };
    } else {
      // Fallback: build env from flat fields
      env["ANTHROPIC_AUTH_TOKEN"] = profile.apiKey;
      env["ANTHROPIC_BASE_URL"] = profile.baseUrl;
      env["ANTHROPIC_MODEL"] = profile.model;
      env["ANTHROPIC_SMALL_FAST_MODEL"] = profile.model;
      env["ANTHROPIC_DEFAULT_HAIKU_MODEL"] = profile.model;
      env["ANTHROPIC_DEFAULT_SONNET_MODEL"] = profile.model;
      env["ANTHROPIC_DEFAULT_OPUS_MODEL"] = profile.model;
      env["CLAUDE_CODE_SUBAGENT_MODEL"] = profile.model;
    }

    // Clean legacy flat fields
    delete merged.baseUrl;
    delete merged.apiKey;
    delete merged.model;
    delete merged.timeout;

    await this.write(merged);
  }

  /**
   * Write full settings object (for initial config import).
   * Preserves the entire structure of settings.json.
   */
  async writeSettings(settings: Record<string, unknown>): Promise<void> {
    await this.write(settings);
  }
}
