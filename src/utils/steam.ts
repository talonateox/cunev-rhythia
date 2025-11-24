import steamworks from "steamworks.js";
import { logger } from "./logger";

export let steamClient: Omit<
  typeof import("steamworks.js/client"),
  "init" | "runCallbacks"
>;

export async function initializeSteam() {
  try {
    steamClient = steamworks.init(2250500);
  } catch (error) {
    console.log("no steam");
    process.exit();
  }
}

export function isCloudAvailable(): boolean {
  try {
    return (
      !!steamClient &&
      steamClient.cloud.isEnabledForAccount() &&
      steamClient.cloud.isEnabledForApp()
    );
  } catch {
    return false;
  }
}

export function cloudWriteConfig(json: string): boolean {
  try {
    if (!isCloudAvailable()) return false;
    return steamClient.cloud.writeFile("config.json", json);
  } catch {
    return false;
  }
}

export function cloudReadConfig(): string | null {
  try {
    if (!isCloudAvailable()) return null;
    if (!steamClient.cloud.fileExists("config.json")) return null;
    logger("Retrieving config from STEAM CLOUD");

    return steamClient.cloud.readFile("config.json");
  } catch {
    return null;
  }
}
