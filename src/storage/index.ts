import { ConversationState, AnswerHistory } from "../types.js";
import { persistConversation as persistLocal, persistAnswer as persistAnswerLocal, updateProspectProfile as updateProspectProfileLocal } from "./localStore.js";
import { persistToSheet, persistAnswerToSheet, updateProspectProfile as updateProspectProfileSheet } from "./googleSheets.js";

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

// Sauvegarde en temps réel de chaque réponse
export async function persistAnswer(phone: string, answerHistory: AnswerHistory, updatedState: ConversationState) {
  // eslint-disable-next-line no-console
  console.log(`[STORAGE] Sauvegarde réponse en temps réel pour ${phone}, question: ${answerHistory.questionId}`);
  
  // Sauvegarder la réponse individuelle
  const answerPushed = await persistAnswerToSheet(phone, answerHistory, updatedState);
  if (!answerPushed) {
    persistAnswerLocal(phone, answerHistory, updatedState);
  }
  
  // Mettre à jour la fiche prospect (toujours en local, et dans Sheets si disponible)
  updateProspectProfileLocal(phone, updatedState);
  await updateProspectProfileSheet(phone, updatedState);
}

