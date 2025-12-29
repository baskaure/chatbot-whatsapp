import fs from "fs";
import path from "path";
import { BotConfig } from "./types.js";

const CONFIG_PATH = process.env.BOT_CONFIG_PATH || "config/config.json";

export function loadConfig(): BotConfig {
  const resolved = path.resolve(CONFIG_PATH);
  const content = fs.readFileSync(resolved, "utf8");
  const parsed = JSON.parse(content) as BotConfig;
  return parsed;
}

export function saveConfig(config: BotConfig): void {
  const resolved = path.resolve(CONFIG_PATH);
  fs.writeFileSync(resolved, JSON.stringify(config, null, 2), "utf8");
}

