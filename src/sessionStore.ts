import Redis from "ioredis";
import { ConversationState } from "./types.js";

const redisUrl = process.env.REDIS_URL;
const redis = redisUrl ? new Redis(redisUrl) : null;
const MEMORY_STORE = new Map<string, ConversationState>();
const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 60 * 60 * 6); // 6h

async function readState(phone: string): Promise<ConversationState | null> {
  if (!redis) return MEMORY_STORE.get(phone) || null;
  const raw = await redis.get(`session:${phone}`);
  return raw ? (JSON.parse(raw) as ConversationState) : null;
}

async function writeState(phone: string, state: ConversationState) {
  if (!redis) {
    MEMORY_STORE.set(phone, state);
    return;
  }
  await redis.set(`session:${phone}`, JSON.stringify(state), "EX", SESSION_TTL_SECONDS);
}

export async function getOrCreateSession(phone: string): Promise<ConversationState> {
  const existing = await readState(phone);
  if (existing) return existing;
  const session: ConversationState = {
    phone,
    startedAt: new Date().toISOString(),
    currentQuestionIndex: -1,
    answers: {},
    score: 0,
    status: "collecting",
    calendlySent: false,
    resourceSent: false,
    calendlyPreference: null,
  };
  await writeState(phone, session);
  return session;
}

export async function updateSession(phone: string, data: Partial<ConversationState>) {
  const prev = await getOrCreateSession(phone);
  await writeState(phone, { ...prev, ...data });
}

export async function resetSession(phone: string) {
  if (!redis) {
    MEMORY_STORE.delete(phone);
    return;
  }
  await redis.del(`session:${phone}`);
}

export async function allSessions(): Promise<ConversationState[]> {
  if (!redis) return [...MEMORY_STORE.values()];
  const keys = await redis.keys("session:*");
  const states: ConversationState[] = [];
  for (const key of keys) {
    const raw = await redis.get(key);
    if (raw) states.push(JSON.parse(raw) as ConversationState);
  }
  return states;
}

