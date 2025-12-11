import fs from "fs";
import path from "path";
import { ConversationState } from "../types.js";

const DATA_DIR = process.env.DATA_DIR || "data";
const FILE_PATH = path.join(DATA_DIR, "conversations.jsonl");

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(FILE_PATH)) {
    fs.writeFileSync(FILE_PATH, "");
  }
}

export function persistConversation(state: ConversationState) {
  ensureFile();
  const record = {
    ...state,
    savedAt: new Date().toISOString(),
  };
  fs.appendFileSync(FILE_PATH, JSON.stringify(record) + "\n", "utf8");
}

