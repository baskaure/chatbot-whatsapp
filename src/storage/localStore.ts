import fs from "fs";
import path from "path";
import { ConversationState, AnswerHistory } from "../types.js";

const DATA_DIR = process.env.DATA_DIR || "data";
const FILE_PATH = path.join(DATA_DIR, "conversations.jsonl");
const ANSWERS_FILE_PATH = path.join(DATA_DIR, "answers.jsonl");
const PROSPECTS_FILE_PATH = path.join(DATA_DIR, "prospects.jsonl");

function ensureFile(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "");
  }
}

export function persistConversation(state: ConversationState) {
  ensureFile(FILE_PATH);
  const record = {
    ...state,
    savedAt: new Date().toISOString(),
  };
  fs.appendFileSync(FILE_PATH, JSON.stringify(record) + "\n", "utf8");
}

// Sauvegarde en temps réel de chaque réponse
export function persistAnswer(phone: string, answerHistory: AnswerHistory, updatedState: ConversationState) {
  ensureFile(ANSWERS_FILE_PATH);
  const normalizedPhone = normalizePhoneForStorage(phone);
  const record = {
    phone: normalizedPhone,
    ...answerHistory,
    currentScore: updatedState.score,
    savedAt: new Date().toISOString(),
  };
  fs.appendFileSync(ANSWERS_FILE_PATH, JSON.stringify(record) + "\n", "utf8");
  
  // Mettre à jour la fiche prospect
  updateProspectProfile(phone, updatedState);
}

// Normaliser le numéro de téléphone
function normalizePhoneForStorage(phone: string): string {
  return phone.replace(/^whatsapp:/i, "").trim();
}

// Mise à jour de la fiche prospect en temps réel
export function updateProspectProfile(phone: string, state: ConversationState) {
  ensureFile(PROSPECTS_FILE_PATH);
  
  // Normaliser le numéro de téléphone
  const normalizedPhone = normalizePhoneForStorage(phone);
  
  // Lire toutes les fiches existantes
  let prospects: Record<string, ConversationState> = {};
  if (fs.existsSync(PROSPECTS_FILE_PATH)) {
    const lines = fs.readFileSync(PROSPECTS_FILE_PATH, "utf8").split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const prospect = JSON.parse(line);
        const prospectPhone = normalizePhoneForStorage(prospect.phone || "");
        if (prospectPhone) {
          prospects[prospectPhone] = prospect;
        }
      } catch (e) {
        // Ignorer les lignes invalides
      }
    }
  }
  
  // Mettre à jour ou créer la fiche avec le téléphone normalisé
  const updatedState = {
    ...state,
    phone: normalizedPhone,
    lastActivityAt: new Date().toISOString(),
  };
  
  prospects[normalizedPhone] = updatedState;
  
  // Réécrire toutes les fiches
  const content = Object.values(prospects)
    .map((p) => JSON.stringify(p))
    .join("\n") + "\n";
  fs.writeFileSync(PROSPECTS_FILE_PATH, content, "utf8");
  
  // eslint-disable-next-line no-console
  console.log(`[STORAGE] Fiche prospect mise à jour pour ${normalizedPhone}`);
}

// Supprimer/réinitialiser une fiche prospect
export function resetProspectProfile(phone: string): void {
  const normalizedPhone = normalizePhoneForStorage(phone);
  
  if (!fs.existsSync(PROSPECTS_FILE_PATH)) return;
  
  // Lire toutes les fiches existantes
  const lines = fs.readFileSync(PROSPECTS_FILE_PATH, "utf8").split("\n").filter(Boolean);
  const prospects: ConversationState[] = [];
  
  for (const line of lines) {
    try {
      const prospect = JSON.parse(line) as ConversationState;
      const prospectPhone = normalizePhoneForStorage(prospect.phone || "");
      // Exclure la fiche du prospect à réinitialiser
      if (prospectPhone && prospectPhone !== normalizedPhone) {
        prospects.push(prospect);
      }
    } catch (e) {
      // Ignorer les lignes invalides
    }
  }
  
  // Réécrire toutes les fiches sauf celle supprimée
  const content = prospects
    .map((p) => JSON.stringify(p))
    .join("\n") + (prospects.length > 0 ? "\n" : "");
  fs.writeFileSync(PROSPECTS_FILE_PATH, content, "utf8");
  
  // eslint-disable-next-line no-console
  console.log(`[STORAGE] Fiche prospect supprimée pour ${normalizedPhone}`);
}

// Fonctions de lecture pour l'admin
export function getAllProspects(): ConversationState[] {
  if (!fs.existsSync(PROSPECTS_FILE_PATH)) return [];
  const lines = fs.readFileSync(PROSPECTS_FILE_PATH, "utf8").split("\n").filter(Boolean);
  return lines.map((line) => {
    try {
      return JSON.parse(line) as ConversationState;
    } catch {
      return null;
    }
  }).filter((p): p is ConversationState => p !== null);
}

export function getAllConversations(): any[] {
  if (!fs.existsSync(FILE_PATH)) return [];
  const lines = fs.readFileSync(FILE_PATH, "utf8").split("\n").filter(Boolean);
  return lines.map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter((c) => c !== null);
}

export function getAllAnswers(): any[] {
  if (!fs.existsSync(ANSWERS_FILE_PATH)) return [];
  const lines = fs.readFileSync(ANSWERS_FILE_PATH, "utf8").split("\n").filter(Boolean);
  return lines.map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter((a) => a !== null);
}

