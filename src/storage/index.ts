import { ConversationState, AnswerHistory } from "../types.js";
import { persistConversation as persistLocal, persistAnswerLocal, updateProspectProfile as updateProspectProfileLocal } from "./localStore.js";
import { persistToSheet, persistAnswerToSheet, updateProspectProfile as updateProspectProfileSheet } from "./googleSheets.js";
import {
  persistConversationDB,
  persistAnswerDB,
  updateProspectProfileDB,
  isDatabaseAvailable,
} from "./db.js";

export async function persistConversation(state: ConversationState) {
  // eslint-disable-next-line no-console
  console.log(`[STORAGE] Sauvegarde conversation pour ${state.phone}, score: ${state.score}, statut: ${state.status}`);
  
  // PRIORITÉ 1: PostgreSQL si disponible (persistance garantie)
  if (isDatabaseAvailable()) {
    await persistConversationDB(state).catch((err) => {
      // eslint-disable-next-line no-console
      console.log("[STORAGE] Erreur sauvegarde DB, fallback vers local:", err);
    });
  }
  
  // PRIORITÉ 2: Fichiers locaux (cache/backup)
  persistLocal(state);
  
  // PRIORITÉ 3: Google Sheets (backup externe)
  await persistToSheet(state).catch((err) => {
    // eslint-disable-next-line no-console
    console.log("[STORAGE] Erreur sauvegarde Sheets (ignorée):", err);
  });
}

// Sauvegarde en temps réel de chaque réponse
export async function persistAnswer(phone: string, answerHistory: AnswerHistory, updatedState: ConversationState) {
  // eslint-disable-next-line no-console
  console.log(`[STORAGE] Sauvegarde réponse en temps réel pour ${phone}, question: ${answerHistory.questionId}`);
  
  // PRIORITÉ 1: PostgreSQL si disponible
  if (isDatabaseAvailable()) {
    await persistAnswerDB(phone, answerHistory, updatedState.score).catch((err) => {
      // eslint-disable-next-line no-console
      console.log("[STORAGE] Erreur sauvegarde réponse DB, fallback vers local:", err);
    });
  }
  
  // PRIORITÉ 2: Fichiers locaux
  persistAnswerLocal(phone, answerHistory, updatedState);
  
  // PRIORITÉ 3: Google Sheets
  await persistAnswerToSheet(phone, answerHistory, updatedState).catch((err) => {
    // eslint-disable-next-line no-console
    console.log("[STORAGE] Erreur sauvegarde réponse Sheets (ignorée):", err);
  });
  
  // Mettre à jour la fiche prospect
  if (isDatabaseAvailable()) {
    await updateProspectProfileDB(updatedState).catch((err) => {
      // eslint-disable-next-line no-console
      console.log("[STORAGE] Erreur mise à jour prospect DB, fallback vers local:", err);
    });
  }
  updateProspectProfileLocal(phone, updatedState);
  await updateProspectProfileSheet(phone, updatedState).catch((err) => {
    // eslint-disable-next-line no-console
    console.log("[STORAGE] Erreur mise à jour prospect Sheets (ignorée):", err);
  });
}

