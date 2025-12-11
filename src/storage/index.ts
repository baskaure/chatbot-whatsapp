import { ConversationState } from "../types.js";
import { persistConversation as persistLocal } from "./localStore.js";
import { persistToSheet } from "./googleSheets.js";

export async function persistConversation(state: ConversationState) {
  const pushed = await persistToSheet(state);
  if (!pushed) {
    persistLocal(state);
  }
}

