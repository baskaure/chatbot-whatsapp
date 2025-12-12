import { ConversationState } from "../types.js";
import { persistConversation as persistLocal } from "./localStore.js";
import { persistToSheet } from "./googleSheets.js";

export async function persistConversation(state: ConversationState) {
  // eslint-disable-next-line no-console
  console.log(`[STORAGE] Sauvegarde conversation pour ${state.phone}, score: ${state.score}, statut: ${state.status}`);
  const pushed = await persistToSheet(state);
  if (!pushed) {
    // eslint-disable-next-line no-console
    console.log("[STORAGE] Fallback vers sauvegarde locale");
    persistLocal(state);
  }
}

