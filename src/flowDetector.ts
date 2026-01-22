import { BotConfig, FormFlow, SectorFlow } from "./types.js";

/**
 * Détecte le mot-clé dans un message et retourne le flow correspondant
 */
export function detectFormFlow(message: string, config: BotConfig): FormFlow | null {
  if (!config.form_flows || config.form_flows.length === 0) {
    return null;
  }

  const normalized = message.toLowerCase().trim();

  // Chercher le mot-clé dans le message
  for (const flow of config.form_flows) {
    const keyword = flow.keyword.toLowerCase().trim();
    // Vérifier si le mot-clé est présent dans le message
    if (normalized.includes(keyword)) {
      return flow;
    }
  }

  return null;
}

/**
 * Récupère le flow pour un secteur donné
 */
export function getSectorFlow(sector: string, config: BotConfig): SectorFlow | null {
  if (!config.sector_flows || config.sector_flows.length === 0) {
    return null;
  }

  const normalized = sector.toLowerCase().trim();

  for (const flow of config.sector_flows) {
    if (flow.sector.toLowerCase().trim() === normalized) {
      return flow;
    }
  }

  return null;
}

/**
 * Récupère les questions à poser selon le flow actif
 */
export function getQuestionsForFlow(
  formFlowId: string | undefined,
  sector: string | undefined,
  config: BotConfig
): { questions: any[]; skipQuestions: string[] } {
  // Cas 1 : Flow de formulaire avec mot-clé
  if (formFlowId && config.form_flows) {
    const formFlow = config.form_flows.find((f) => f.id === formFlowId);
    if (formFlow) {
      return {
        questions: formFlow.questions,
        skipQuestions: formFlow.skip_questions || [],
      };
    }
  }

  // Cas 2 : Flow par secteur
  if (sector && config.sector_flows) {
    const sectorFlow = getSectorFlow(sector, config);
    if (sectorFlow) {
      return {
        questions: sectorFlow.questions,
        skipQuestions: [],
      };
    }
  }

  // Cas 3 : Questions par défaut (legacy)
  return {
    questions: config.questions || [],
    skipQuestions: [],
  };
}

/**
 * Vérifie si une question doit être ignorée (déjà posée dans le formulaire)
 */
export function shouldSkipQuestion(questionId: string, skipQuestions: string[]): boolean {
  return skipQuestions.includes(questionId);
}
