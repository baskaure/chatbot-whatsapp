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

