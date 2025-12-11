import { BotConfig, ConversationState, IncomingMessage } from "./types.js";
import { getOrCreateSession, updateSession } from "./sessionStore.js";
import { sendMessage } from "./provider/sendMessage.js";
import { computeTotalScore } from "./scoring.js";
import { persistConversation } from "./storage/index.js";

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function renderOptions(options: string[]): string {
  return options.map((opt) => `- ${opt}`).join("\n");
}

async function askNextQuestion(state: ConversationState, config: BotConfig) {
  const idx = state.currentQuestionIndex + 1;
  const next = config.questions[idx];
  if (!next) return;
  const message = `${next.label}\n${renderOptions(next.options)}`;
  await sendMessage({ to: state.phone, body: message });
  await updateSession(state.phone, { currentQuestionIndex: idx });
}

function isValidAnswer(answer: string, options: string[]): string | null {
  const normalized = normalize(answer);
  const found = options.find((opt) => normalize(opt) === normalized);
  return found ?? null;
}

async function handleQualified(state: ConversationState, config: BotConfig) {
  await updateSession(state.phone, { status: "awaiting_preference" });
  await sendMessage({ to: state.phone, body: config.messages.qualified_intro });
}

async function handleDisqualified(state: ConversationState, config: BotConfig) {
  await updateSession(state.phone, { status: "disqualified" });
  await sendMessage({ to: state.phone, body: config.messages.disqualified });
  await sendMessage({ to: state.phone, body: "Veux-tu que je t'envoie la ressource ? (oui/non)" });
}

export async function handleIncoming(message: IncomingMessage, config: BotConfig) {
  const body = message.body || "";
  const phone = message.from;
  const state = await getOrCreateSession(phone);

  // Step 1: start flow
  if (state.currentQuestionIndex === -1 && state.status === "collecting") {
    const normalized = normalize(body);
    const shouldStart = config.start_keywords.some((kw) => normalized.includes(kw));
    if (!shouldStart) {
      await sendMessage({ to: phone, body: config.welcome });
      return;
    }
    await sendMessage({ to: phone, body: "Super, on commence." });
    await askNextQuestion(state, config);
    return;
  }

  // Awaiting calendly preference
  if (state.status === "awaiting_preference") {
    const pref = normalize(body);
    if (!["matin", "après-midi", "apres-midi", "apm", "pm", "am"].includes(pref)) {
      await sendMessage({ to: phone, body: "Préférences possibles : matin / après-midi" });
      return;
    }
    const resolvedPref = pref.startsWith("mat") ? "matin" : "après-midi";
    const calendly = config.messages.calendly_link
      .replace("{phone}", encodeURIComponent(phone))
      .replace("{name}", encodeURIComponent(phone))
      .replace("{preference}", encodeURIComponent(resolvedPref));
    await sendMessage({ to: phone, body: `Parfait, voici le lien pour réserver : ${calendly}` });
    await updateSession(phone, { status: "qualified", calendlyPreference: resolvedPref, calendlySent: true });
    const persisted = await getOrCreateSession(phone);
    persistConversation(persisted);
    return;
  }

  // If disqualified, ignore further
  if (state.status === "disqualified") {
    const normalized = normalize(body);
    if (normalized === "oui" || normalized === "ok") {
      await sendMessage({ to: phone, body: config.messages.resource_link });
      await updateSession(phone, { resourceSent: true });
      const persisted = await getOrCreateSession(phone);
      persistConversation(persisted);
      return;
    }
    await sendMessage({ to: phone, body: "Conversation close. Réponds 'oui' si tu veux la ressource." });
    return;
  }

  // Validate current question answer
  const currentQ = config.questions[state.currentQuestionIndex];
  if (!currentQ) {
    await sendMessage({ to: phone, body: "On reprend : " });
    await askNextQuestion(state, config);
    return;
  }

  const validAnswer = isValidAnswer(body, currentQ.options);
  if (!validAnswer) {
    await sendMessage({
      to: phone,
      body: `Je n'ai pas compris. Merci de choisir parmi :\n${renderOptions(currentQ.options)}`,
    });
    return;
  }

  const answers = { ...state.answers, [currentQ.id]: validAnswer };
  const score = computeTotalScore({ ...state, answers }, config);
  await updateSession(phone, { answers, score });

  const nextIndex = state.currentQuestionIndex + 1;
  if (nextIndex >= config.questions.length - 1) {
    // Last question answered
    const totalScore = computeTotalScore({ ...state, answers }, config);
    await updateSession(phone, { score: totalScore });
    if (totalScore >= config.qualified_threshold) {
      const refreshed = await getOrCreateSession(phone);
      await handleQualified(refreshed, config);
    } else {
      const refreshed = await getOrCreateSession(phone);
      await handleDisqualified(refreshed, config);
    }
    return;
  }

  // Ask following question
  await updateSession(phone, { currentQuestionIndex: state.currentQuestionIndex + 1 });
  const refreshed = await getOrCreateSession(phone);
  await askNextQuestion(refreshed, config);
}
