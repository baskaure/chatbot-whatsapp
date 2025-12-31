import pg from "pg";
import { ConversationState, AnswerHistory } from "../types.js";

const { Pool } = pg;

// Connexion à PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("render.com") ? { rejectUnauthorized: false } : undefined,
});

// Vérifier la connexion
pool.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("[DB] Erreur PostgreSQL:", err);
});

// Initialiser les tables si elles n'existent pas
export async function initDatabase(): Promise<boolean> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS prospects (
        phone VARCHAR(50) PRIMARY KEY,
        started_at TIMESTAMP NOT NULL,
        last_activity_at TIMESTAMP NOT NULL,
        answers JSONB NOT NULL DEFAULT '{}',
        answer_history JSONB NOT NULL DEFAULT '[]',
        score INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL,
        decision VARCHAR(20),
        decision_reason TEXT,
        calendly_sent BOOLEAN NOT NULL DEFAULT false,
        resource_sent BOOLEAN NOT NULL DEFAULT false,
        calendly_preference VARCHAR(20),
        metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        phone VARCHAR(50) NOT NULL,
        started_at TIMESTAMP NOT NULL,
        last_activity_at TIMESTAMP NOT NULL,
        answers JSONB NOT NULL DEFAULT '{}',
        answer_history JSONB NOT NULL DEFAULT '[]',
        score INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL,
        decision VARCHAR(20),
        decision_reason TEXT,
        calendly_sent BOOLEAN NOT NULL DEFAULT false,
        resource_sent BOOLEAN NOT NULL DEFAULT false,
        calendly_preference VARCHAR(20),
        metadata JSONB NOT NULL DEFAULT '{}',
        saved_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS answers (
        id SERIAL PRIMARY KEY,
        phone VARCHAR(50) NOT NULL,
        question_id VARCHAR(100) NOT NULL,
        question_label TEXT NOT NULL,
        answer TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        score INTEGER NOT NULL DEFAULT 0,
        current_score INTEGER NOT NULL DEFAULT 0,
        saved_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_prospects_phone ON prospects(phone);
      CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone);
      CREATE INDEX IF NOT EXISTS idx_conversations_saved_at ON conversations(saved_at DESC);
      CREATE INDEX IF NOT EXISTS idx_answers_phone ON answers(phone);
      CREATE INDEX IF NOT EXISTS idx_answers_timestamp ON answers(timestamp DESC);
    `);
    
    // eslint-disable-next-line no-console
    console.log("[DB] Tables initialisées avec succès");
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[DB] Erreur initialisation:", err);
    return false;
  }
}

// Normaliser le numéro de téléphone
function normalizePhone(phone: string): string {
  return phone.replace(/^whatsapp:/i, "").trim();
}

// Sauvegarder une conversation
export async function persistConversationDB(state: ConversationState): Promise<boolean> {
  try {
    const normalizedPhone = normalizePhone(state.phone);
    await pool.query(
      `INSERT INTO conversations (
        phone, started_at, last_activity_at, answers, answer_history, score, 
        status, decision, decision_reason, calendly_sent, resource_sent, 
        calendly_preference, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        normalizedPhone,
        state.startedAt,
        state.lastActivityAt,
        JSON.stringify(state.answers),
        JSON.stringify(state.answerHistory),
        state.score,
        state.status,
        state.decision,
        state.decisionReason,
        state.calendlySent,
        state.resourceSent,
        state.calendlyPreference,
        JSON.stringify(state.metadata),
      ]
    );
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[DB] Erreur sauvegarde conversation:", err);
    return false;
  }
}

// Sauvegarder une réponse
export async function persistAnswerDB(
  phone: string,
  answerHistory: AnswerHistory,
  currentScore: number
): Promise<boolean> {
  try {
    const normalizedPhone = normalizePhone(phone);
    await pool.query(
      `INSERT INTO answers (phone, question_id, question_label, answer, timestamp, score, current_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        normalizedPhone,
        answerHistory.questionId,
        answerHistory.questionLabel,
        answerHistory.answer,
        answerHistory.timestamp,
        answerHistory.score,
        currentScore,
      ]
    );
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[DB] Erreur sauvegarde réponse:", err);
    return false;
  }
}

// Mettre à jour ou créer un prospect
export async function updateProspectProfileDB(state: ConversationState): Promise<boolean> {
  try {
    const normalizedPhone = normalizePhone(state.phone);
    await pool.query(
      `INSERT INTO prospects (
        phone, started_at, last_activity_at, answers, answer_history, score,
        status, decision, decision_reason, calendly_sent, resource_sent,
        calendly_preference, metadata, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      ON CONFLICT (phone) DO UPDATE SET
        last_activity_at = $3,
        answers = $4,
        answer_history = $5,
        score = $6,
        status = $7,
        decision = $8,
        decision_reason = $9,
        calendly_sent = $10,
        resource_sent = $11,
        calendly_preference = $12,
        metadata = $13,
        updated_at = NOW()`,
      [
        normalizedPhone,
        state.startedAt,
        state.lastActivityAt,
        JSON.stringify(state.answers),
        JSON.stringify(state.answerHistory),
        state.score,
        state.status,
        state.decision,
        state.decisionReason,
        state.calendlySent,
        state.resourceSent,
        state.calendlyPreference,
        JSON.stringify(state.metadata),
      ]
    );
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[DB] Erreur mise à jour prospect:", err);
    return false;
  }
}

// Récupérer tous les prospects
export async function getAllProspectsDB(): Promise<ConversationState[]> {
  try {
    const result = await pool.query(
      `SELECT * FROM prospects ORDER BY last_activity_at DESC`
    );
    return result.rows.map((row) => ({
      phone: row.phone,
      startedAt: row.started_at,
      lastActivityAt: row.last_activity_at,
      answers: row.answers,
      answerHistory: row.answer_history,
      score: row.score,
      status: row.status,
      decision: row.decision,
      decisionReason: row.decision_reason,
      calendlySent: row.calendly_sent,
      resourceSent: row.resource_sent,
      calendlyPreference: row.calendly_preference,
      metadata: row.metadata,
      currentQuestionIndex: -1, // Pas stocké en DB, valeur par défaut
    }));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[DB] Erreur récupération prospects:", err);
    return [];
  }
}

// Récupérer toutes les conversations
export async function getAllConversationsDB(): Promise<any[]> {
  try {
    const result = await pool.query(
      `SELECT * FROM conversations ORDER BY saved_at DESC LIMIT 1000`
    );
    return result.rows.map((row) => ({
      phone: row.phone,
      startedAt: row.started_at,
      lastActivityAt: row.last_activity_at,
      answers: row.answers,
      answerHistory: row.answer_history,
      score: row.score,
      status: row.status,
      decision: row.decision,
      decisionReason: row.decision_reason,
      calendlySent: row.calendly_sent,
      resourceSent: row.resource_sent,
      calendlyPreference: row.calendly_preference,
      metadata: row.metadata,
      savedAt: row.saved_at,
    }));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[DB] Erreur récupération conversations:", err);
    return [];
  }
}

// Récupérer toutes les réponses
export async function getAllAnswersDB(): Promise<any[]> {
  try {
    const result = await pool.query(
      `SELECT * FROM answers ORDER BY timestamp DESC LIMIT 5000`
    );
    return result.rows.map((row) => ({
      phone: row.phone,
      questionId: row.question_id,
      questionLabel: row.question_label,
      answer: row.answer,
      timestamp: row.timestamp,
      score: row.score,
      currentScore: row.current_score,
      savedAt: row.saved_at,
    }));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[DB] Erreur récupération réponses:", err);
    return [];
  }
}

// Supprimer un prospect
export async function resetProspectProfileDB(phone: string): Promise<boolean> {
  try {
    const normalizedPhone = normalizePhone(phone);
    await pool.query(`DELETE FROM prospects WHERE phone = $1`, [normalizedPhone]);
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[DB] Erreur suppression prospect:", err);
    return false;
  }
}

// Vérifier si la DB est disponible
export function isDatabaseAvailable(): boolean {
  return !!process.env.DATABASE_URL;
}

