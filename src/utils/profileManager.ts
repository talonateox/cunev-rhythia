import * as fs from "fs";
import * as path from "path";
import { logger } from "./logger";

export interface UserProfile {
  email: string;
  password: string;
  isLoggedIn: boolean;
  token?: string;
  supabaseSession?: unknown;
}

const DEFAULT_PROFILE: UserProfile = {
  email: "",
  password: "",
  isLoggedIn: false,
};

const PROFILE_FILE = path.join(process.cwd(), "profile.json");

export class ProfileManager {
  private static profile: UserProfile = { ...DEFAULT_PROFILE };
  private static getHooks = new Set<() => void | Promise<void>>();
  private static pendingSessionRefresh: Promise<unknown> | null = null;

  private static buildProfile(): UserProfile {
    const supabaseSession = this.profile.supabaseSession as
      | Record<string, unknown>
      | null
      | undefined;

    const tokenFromSession =
      supabaseSession && typeof supabaseSession === "object"
        ? ((supabaseSession as any).access_token as string | undefined)
        : undefined;

    return {
      ...this.profile,
      token: this.profile.token || tokenFromSession || "",
    };
  }

  private static runGetHooks(): void {
    for (const hook of this.getHooks) {
      try {
        const maybePromise = hook();
        if (maybePromise && typeof (maybePromise as any).catch === "function") {
          (maybePromise as Promise<void>).catch((error) => {
            console.error("ProfileManager get hook failed:", error);
          });
        }
      } catch (error) {
        console.error("ProfileManager get hook threw:", error);
      }
    }
  }

  
  static load(): UserProfile {
    try {
      if (fs.existsSync(PROFILE_FILE)) {
        const fileContent = fs.readFileSync(PROFILE_FILE, "utf8");
        const savedProfile = JSON.parse(fileContent);

        this.profile = {
          ...DEFAULT_PROFILE,
          ...savedProfile,
        };

        logger("Profile loaded from profile.json");
      } else {
        logger("No profile.json found, using defaults");
        this.profile = { ...DEFAULT_PROFILE };
      }
    } catch (error) {
      console.error("Error loading profile.json, using defaults:", error);
      this.profile = { ...DEFAULT_PROFILE };
    }

    return { ...this.profile };
  }

  
  static save(): void {
    try {
      const profileJson = JSON.stringify(this.profile, null, 2);
      fs.writeFileSync(PROFILE_FILE, profileJson, "utf8");
      logger("Profile saved to profile.json");
    } catch (error) {
      console.error("Error saving profile.json:", error);
    }
  }

  
  static get(): UserProfile {
    this.ensureSessionRefresh();
    this.runGetHooks();
    return this.buildProfile();
  }

  private static ensureSessionRefresh(): void {
    const profile = this.profile;
    const supabaseSession = profile.supabaseSession as
      | Record<string, unknown>
      | null
      | undefined;

    const hasSession = Boolean(supabaseSession);
    const hasToken = Boolean(profile.token);

    if (!hasSession || hasToken || this.pendingSessionRefresh) {
      return;
    }
  }

  static peek(): UserProfile {
    return this.buildProfile();
  }

  static registerGetHook(hook: () => void | Promise<void>): void {
    this.getHooks.add(hook);
  }

  static unregisterGetHook(hook: () => void | Promise<void>): void {
    this.getHooks.delete(hook);
  }

  
  static update(updates: Partial<UserProfile>): void {
    this.profile = {
      ...this.profile,
      ...updates,
    };
  }

  
  static setCredentials(email: string, password: string, token?: string): void {
    this.profile.email = email;
    this.profile.password = password;
    this.profile.isLoggedIn = true;
    if (token) {
      this.profile.token = token;
    }
    this.save();
  }

  
  static logout(): void {
    this.profile.isLoggedIn = false;
    this.save();
  }

  
  static profileExists(): boolean {
    return fs.existsSync(PROFILE_FILE);
  }

  
  static reset(): void {
    this.profile = { ...DEFAULT_PROFILE };
    this.save();
  }
}
