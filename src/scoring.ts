import { BotConfig, ConversationState } from "./types.js";

export function scoreAnswer(questionId: string, answer: string, config: BotConfig): number {
  const q = config.questions.find((item) => item.id === questionId);
  if (!q) return 0;
  return q.scores[answer] ?? 0;
}

export function computeTotalScore(state: ConversationState, config: BotConfig): number {
  return Object.entries(state.answers).reduce((acc, [qid, ans]) => {
    return acc + scoreAnswer(qid, ans, config);
  }, 0);
}

