import { BotConfig, ConversationState } from "./types.js";
import { getQuestionsForFlow } from "./flowDetector.js";

export function scoreAnswer(questionId: string, answer: string, config: BotConfig, state?: ConversationState): number {
  // Si on a un state, utiliser les questions du flow actif
  if (state) {
    const { questions } = getQuestionsForFlow(state.formFlowId, state.sector, config);
    const q = questions.find((item) => item.id === questionId);
    if (q) return q.scores[answer] ?? 0;
  }
  
  // Fallback : chercher dans les questions par défaut
  const q = config.questions.find((item) => item.id === questionId);
  if (!q) return 0;
  return q.scores[answer] ?? 0;
}

export function computeTotalScore(state: ConversationState, config: BotConfig): number {
  return Object.entries(state.answers).reduce((acc, [qid, ans]) => {
    return acc + scoreAnswer(qid, ans, config, state);
  }, 0);
}

