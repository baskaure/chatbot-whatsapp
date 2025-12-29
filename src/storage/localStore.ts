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
  const record = {
    phone,
    ...answerHistory,
    currentScore: updatedState.score,
    savedAt: new Date().toISOString(),
  };
  fs.appendFileSync(ANSWERS_FILE_PATH, JSON.stringify(record) + "\n", "utf8");
  
  // Mettre à jour la fiche prospect
  updateProspectProfile(phone, updatedState);
}

// Mise à jour de la fiche prospect en temps réel
function updateProspectProfile(phone: string, state: ConversationState) {
  ensureFile(PROSPECTS_FILE_PATH);
  
  // Lire toutes les fiches existantes
  let prospects: Record<string, ConversationState> = {};
  if (fs.existsSync(PROSPECTS_FILE_PATH)) {
    const lines = fs.readFileSync(PROSPECTS_FILE_PATH, "utf8").split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const prospect = JSON.parse(line);
        prospects[prospect.phone] = prospect;
      } catch (e) {
        // Ignorer les lignes invalides
      }
    }
  }
  
  // Mettre à jour ou créer la fiche
  prospects[phone] = {
    ...state,
    lastActivityAt: new Date().toISOString(),
  };
  
  // Réécrire toutes les fiches
  const content = Object.values(prospects)
    .map((p) => JSON.stringify(p))
    .join("\n") + "\n";
  fs.writeFileSync(PROSPECTS_FILE_PATH, content, "utf8");
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

