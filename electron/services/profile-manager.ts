import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { Profile } from "../../src/types";

interface ProfilesFile {
  version: 1;
  profiles: Profile[];
}

export interface CreateProfileInput {
  name: string;
  provider: string;
  baseUrl: string;
  encryptedApiKey?: string;
  model: string;
  timeout: number;
  notes?: string;
  env?: Record<string, string>;
}

export interface UpdateProfileInput {
  name?: string;
  provider?: string;
  baseUrl?: string;
  encryptedApiKey?: string;
  model?: string;
  timeout?: number;
  notes?: string;
  env?: Record<string, string>;
}

export class ProfileManager {
  private dataDir: string;
  private filePath: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.filePath = join(dataDir, "profiles.json");
  }

  /** Read profiles from file, return empty array if not found */
  async list(): Promise<Profile[]> {
    try {
      const content = await readFile(this.filePath, "utf-8");
      const data: ProfilesFile = JSON.parse(content);
      return data.profiles;
    } catch {
      return [];
    }
  }

  /** Save profiles to file */
  private async save(profiles: Profile[]): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    const data: ProfilesFile = { version: 1, profiles };
    await writeFile(this.filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  /** Generate a simple UUID-like ID */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /** Create a new profile */
  async create(input: CreateProfileInput): Promise<Profile> {
    const profiles = await this.list();
    const now = new Date().toISOString();
    const profile: Profile = {
      id: this.generateId(),
      name: input.name,
      provider: input.provider as Profile["provider"],
      baseUrl: input.baseUrl,
      encryptedApiKey: input.encryptedApiKey,
      model: input.model,
      timeout: input.timeout,
      isActive: false,
      createdAt: now,
      updatedAt: now,
      notes: input.notes,
      env: input.env,
    };
    profiles.push(profile);
    await this.save(profiles);
    return profile;
  }

  /** Update an existing profile */
  async update(id: string, updates: UpdateProfileInput): Promise<Profile | null> {
    const profiles = await this.list();
    const idx = profiles.findIndex((p) => p.id === id);
    if (idx === -1) return null;

    const profile = profiles[idx];
    if (updates.name !== undefined) profile.name = updates.name;
    if (updates.provider !== undefined) profile.provider = updates.provider as Profile["provider"];
    if (updates.baseUrl !== undefined) profile.baseUrl = updates.baseUrl;
    if (updates.encryptedApiKey !== undefined) profile.encryptedApiKey = updates.encryptedApiKey;
    if (updates.model !== undefined) profile.model = updates.model;
    if (updates.timeout !== undefined) profile.timeout = updates.timeout;
    if (updates.notes !== undefined) profile.notes = updates.notes;
    if (updates.env !== undefined) profile.env = updates.env;
    profile.updatedAt = new Date().toISOString();

    profiles[idx] = profile;
    await this.save(profiles);
    return profile;
  }

  /** Delete a profile by ID */
  async delete(id: string): Promise<boolean> {
    const profiles = await this.list();
    const idx = profiles.findIndex((p) => p.id === id);
    if (idx === -1) return false;

    profiles.splice(idx, 1);
    await this.save(profiles);
    return true;
  }

  /** Get a profile by ID */
  async get(id: string): Promise<Profile | null> {
    const profiles = await this.list();
    return profiles.find((p) => p.id === id) ?? null;
  }

  /** Set a profile as active (and deactivate all others) */
  async setActive(id: string): Promise<void> {
    const profiles = await this.list();
    for (const p of profiles) {
      p.isActive = p.id === id;
    }
    await this.save(profiles);
  }
}
