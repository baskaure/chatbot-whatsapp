import { ConversationState } from "./types.js";

const store = new Map<string, ConversationState>();

export function getOrCreateSession(phone: string): ConversationState {
  const existing = store.get(phone);
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
  };
  store.set(phone, session);
  return session;
}

export function updateSession(phone: string, data: Partial<ConversationState>) {
  const prev = getOrCreateSession(phone);
  store.set(phone, { ...prev, ...data });
}

export function resetSession(phone: string) {
  store.delete(phone);
}

export function allSessions(): ConversationState[] {
  return [...store.values()];
}

