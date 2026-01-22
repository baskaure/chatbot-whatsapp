import { BotConfig, ConversationState, IncomingMessage, DecisionType, AnswerHistory } from "./types.js";
import { getOrCreateSession, updateSession } from "./sessionStore.js";
import { sendMessage } from "./provider/sendMessage.js";
import { computeTotalScore, scoreAnswer } from "./scoring.js";
import { persistConversation, persistAnswer } from "./storage/index.js";
import { detectFormFlow, getQuestionsForFlow, shouldSkipQuestion, getSectorFlow } from "./flowDetector.js";

const reminderTimers = new Map<string, NodeJS.Timeout>();

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function renderOptions(options: string[]): string {
  return options.map((opt) => `- ${opt}`).join("\n");
}

function clearReminder(phone: string) {
  const t = reminderTimers.get(phone);
  if (t) {
    clearTimeout(t);
    reminderTimers.delete(phone);
  }
}

function scheduleReminder(phone: string, question: string, options: string[], config: BotConfig) {
  clearReminder(phone);
  const delayMs = (config.timeouts?.question_seconds || 0) * 1000;
  if (!delayMs) return;
  const timer = setTimeout(async () => {
    await sendMessage({
      to: phone,
      body: `Toujours là ? Merci de répondre à : ${question}\n${renderOptions(options)}`,
    });
  }, delayMs);
  reminderTimers.set(phone, timer);
}

function calculateEngagementLevel(state: ConversationState, config: BotConfig): "low" | "medium" | "high" {
  const answeredRatio = state.metadata.answeredQuestions / Math.max(config.questions.length, 1);
  const scoreRatio = state.score / Math.max(config.qualified_threshold * 1.5, 1);
  
  if (answeredRatio >= 0.8 && scoreRatio >= 0.8) return "high";
  if (answeredRatio >= 0.5 && scoreRatio >= 0.5) return "medium";
  return "low";
}

function makeDecision(state: ConversationState, config: BotConfig): { decision: DecisionType; reason: string } {
  const score = state.score;
  const rules = config.decision_rules;
  
  // RDV : score élevé et conditions remplies
  if (rules.rdv && score >= rules.rdv.minScore) {
    return { decision: "rdv", reason: `Score ${score} >= ${rules.rdv.minScore}, profil qualifié pour RDV` };
  }
  
  // Humain : score moyen-élevé, nécessite intervention humaine
  if (rules.humain && score >= rules.humain.minScore) {
    return { decision: "humain", reason: `Score ${score} >= ${rules.humain.minScore}, nécessite suivi humain` };
  }
  
  // Nurturing : score moyen, besoin d'éducation
  if (rules.nurturing && score >= rules.nurturing.minScore && score <= rules.nurturing.maxScore) {
    return { decision: "nurturing", reason: `Score ${score} entre ${rules.nurturing.minScore} et ${rules.nurturing.maxScore}, nécessite nurturing` };
  }
  
  // Sortie : score trop bas
  if (rules.sortie && score <= rules.sortie.maxScore) {
    return { decision: "sortie", reason: `Score ${score} <= ${rules.sortie.maxScore}, profil non qualifié` };
  }
  
  // Décision par défaut basée sur le seuil de qualification
  if (score >= config.qualified_threshold) {
    return { decision: "rdv", reason: `Score ${score} >= seuil qualification ${config.qualified_threshold}` };
  } else {
    return { decision: "sortie", reason: `Score ${score} < seuil qualification ${config.qualified_threshold}` };
  }
}

async function askNextQuestion(state: ConversationState, config: BotConfig) {
  // Récupérer les questions selon le flow actif
  const { questions, skipQuestions } = getQuestionsForFlow(
    state.formFlowId,
    state.sector,
    config
  );

  if (questions.length === 0) {
    // Aucune question disponible
    return;
  }

  // Trouver la prochaine question non ignorée
  let nextIndex = state.currentQuestionIndex + 1;
  let next = questions[nextIndex];
  
  // Ignorer les questions déjà posées dans le formulaire
  while (next && shouldSkipQuestion(next.id, skipQuestions)) {
    nextIndex++;
    next = questions[nextIndex];
  }

  if (!next) {
    // Plus de questions, terminer le flow
    await finishQuestions(state, config);
    return;
  }

  const message = `${next.label}\n${renderOptions(next.options)}`;
  await sendMessage({ to: state.phone, body: message });
  
  // Mettre à jour le nombre total de questions
  const totalQuestions = Math.max(state.metadata.totalQuestions, questions.length);
  await updateSession(state.phone, { 
    currentQuestionIndex: nextIndex,
    metadata: {
      ...state.metadata,
      totalQuestions,
    },
  });
  scheduleReminder(state.phone, next.label, next.options, config);
}

async function finishQuestions(state: ConversationState, config: BotConfig) {
  // Calculer le score final
  const totalScore = computeTotalScore(state, config);
  await updateSession(state.phone, { score: totalScore });
  
  const { decision, reason } = makeDecision(state, config);
  await updateSession(state.phone, { 
    decision,
    decisionReason: reason,
    status: decision === "rdv" ? "awaiting_preference" : decision === "sortie" ? "disqualified" : "qualified",
  });

  const updated = await getOrCreateSession(state.phone);
  
  if (decision === "rdv") {
    await handleQualified(updated, config);
  } else if (decision === "sortie") {
    await handleDisqualified(updated, config);
  } else {
    // Humain ou Nurturing
    const message = decision === "humain" 
      ? config.messages.humain_message 
      : config.messages.nurturing_message;
    await sendMessage({ to: state.phone, body: message });
    await updateSession(state.phone, { status: "completed" });
    persistConversation(updated);
  }
}

function isValidAnswer(answer: string, options: string[]): string | null {
  const normalized = normalize(answer);
  const found = options.find((opt) => normalize(opt) === normalized);
  return found ?? null;
}

async function handleDecision(state: ConversationState, config: BotConfig, decision: DecisionType) {
  clearReminder(state.phone);
  
  const decisionInfo = makeDecision(state, config);
  await updateSession(state.phone, { 
    status: "completed",
    decision: decisionInfo.decision,
    decisionReason: decisionInfo.reason,
    lastActivityAt: new Date().toISOString(),
  });
  
  const refreshed = await getOrCreateSession(state.phone);
  
  switch (decision) {
    case "rdv":
      await sendMessage({ to: state.phone, body: config.messages.rdv_message || config.messages.qualified_intro });
      await updateSession(state.phone, { status: "awaiting_preference" });
      break;
    case "humain":
      await sendMessage({ to: state.phone, body: config.messages.humain_message || "Un de nos conseillers va te contacter prochainement." });
      break;
    case "nurturing":
      await sendMessage({ to: state.phone, body: config.messages.nurturing_message || "Merci pour tes réponses. On va te tenir informé avec du contenu adapté." });
      break;
    case "sortie":
      await sendMessage({ to: state.phone, body: config.messages.sortie_message || config.messages.disqualified });
      await updateSession(state.phone, { status: "disqualified" });
      await sendMessage({ to: state.phone, body: "Veux-tu que je t'envoie la ressource ? (oui/non)" });
      break;
  }
  
  persistConversation(refreshed);
}

async function handleQualified(state: ConversationState, config: BotConfig) {
  await updateSession(state.phone, { status: "awaiting_preference" });
  clearReminder(state.phone);
  await sendMessage({ to: state.phone, body: config.messages.qualified_intro });
}

async function handleDisqualified(state: ConversationState, config: BotConfig) {
  await updateSession(state.phone, { status: "disqualified" });
  clearReminder(state.phone);
  await sendMessage({ to: state.phone, body: config.messages.disqualified });
  await sendMessage({ to: state.phone, body: "Veux-tu que je t'envoie la ressource ? (oui/non)" });
}

export async function handleIncoming(message: IncomingMessage, config: BotConfig) {
  const body = message.body || "";
  const phone = message.from;
  
  // Récupérer ou créer une session
  const state = await getOrCreateSession(phone);
  
  // Mettre à jour la dernière activité
  await updateSession(phone, { lastActivityAt: new Date().toISOString() });
  
  // Créer/mettre à jour la fiche prospect dès le premier message
  const { updateProspectProfile } = await import("./storage/localStore.js");
  updateProspectProfile(phone, state);

  // PRIORITÉ 1: Vérifier d'abord les statuts spéciaux (disqualified, awaiting_preference)
  // AVANT de vérifier le démarrage, pour éviter que "oui" déclenche un redémarrage

  // If disqualified, handle resource request
  if (state.status === "disqualified") {
    const normalized = normalize(body);
    const acceptKeywords = ["oui", "ok", "yes", "d'accord", "daccord", "envoyer", "envoie", "je veux", "jeveux"];
    if (acceptKeywords.some((kw) => normalized.includes(kw))) {
      // Envoyer la ressource
      await sendMessage({ to: phone, body: config.messages.resource_link });
      await updateSession(phone, { 
        resourceSent: true,
        status: "completed", // Marquer comme terminé après envoi de la ressource
        lastActivityAt: new Date().toISOString(),
      });
      const persisted = await getOrCreateSession(phone);
      persistConversation(persisted);
      
      // Mettre à jour la fiche prospect
      updateProspectProfile(phone, persisted);
      return;
    }
    // Si la ressource a déjà été envoyée, on ignore les messages suivants
    if (state.resourceSent) {
      await sendMessage({ to: phone, body: "La ressource t'a déjà été envoyée. Bonne continuation !" });
      return;
    }
    // Sinon, on rappelle qu'il faut répondre "oui"
    await sendMessage({ to: phone, body: "Réponds 'oui' si tu veux que je t'envoie la ressource." });
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
    await updateSession(phone, { 
      status: "completed",
      decision: "rdv",
      decisionReason: "Calendly envoyé",
      calendlyPreference: resolvedPref, 
      calendlySent: true,
      lastActivityAt: new Date().toISOString(),
    });
    const persisted = await getOrCreateSession(phone);
    persistConversation(persisted);
    return;
  }

  // Step 1: Détection du flow et démarrage
  if (state.currentQuestionIndex === -1 && state.status === "collecting") {
    const normalized = normalize(body);
    
    // CAS 1: Détecter un mot-clé de formulaire (ex: "expert habitat")
    const detectedFlow = detectFormFlow(body, config);
    if (detectedFlow) {
      // Utilisateur vient d'un formulaire avec mot-clé
      await updateSession(phone, {
        formFlowId: detectedFlow.id,
        detectedKeyword: detectedFlow.keyword,
      });
      
      const { questions } = getQuestionsForFlow(detectedFlow.id, undefined, config);
      await updateSession(phone, {
        metadata: {
          ...state.metadata,
          totalQuestions: questions.length,
        },
      });
      
      await sendMessage({ to: phone, body: "Parfait ! Je vais te poser quelques questions complémentaires." });
      const refreshed = await getOrCreateSession(phone);
      await askNextQuestion(refreshed, config);
      return;
    }
    
    // CAS 2: Pas de mot-clé, vérifier si on doit demander le secteur
    if (config.sector_flows && config.sector_flows.length > 0 && !state.sector) {
      // Demander le secteur d'activité
      if (config.default_sector_question) {
        const sectorQ = config.default_sector_question;
        const message = `${sectorQ.label}\n${renderOptions(sectorQ.options)}`;
        await sendMessage({ to: phone, body: message });
        await updateSession(phone, { currentQuestionIndex: -2 }); // -2 = en attente de secteur
        return;
      }
    }
    
    // CAS 3: Démarrage classique avec mots-clés de démarrage
    const shouldStart = config.start_keywords.some((kw) => normalized.includes(kw));
    if (!shouldStart) {
      await sendMessage({ to: phone, body: config.welcome });
      return;
    }
    
    await sendMessage({ to: phone, body: "Super, on commence." });
    
    // Utiliser les questions par défaut ou du secteur si défini
    const { questions } = getQuestionsForFlow(undefined, state.sector, config);
    await updateSession(phone, {
      metadata: {
        ...state.metadata,
        totalQuestions: questions.length,
      },
    });
    
    const refreshed = await getOrCreateSession(phone);
    await askNextQuestion(refreshed, config);
    return;
  }
  
  // Step 1.5: Traitement de la réponse secteur (si en attente)
  if (state.currentQuestionIndex === -2 && config.default_sector_question) {
    const sectorQ = config.default_sector_question;
    const validAnswer = isValidAnswer(body, sectorQ.options);
    
    if (!validAnswer) {
      await sendMessage({
        to: phone,
        body: `Je n'ai pas compris. Merci de choisir parmi :\n${renderOptions(sectorQ.options)}`,
      });
      return;
    }
    
    // Trouver le flow correspondant au secteur
    const sectorFlow = getSectorFlow(validAnswer, config);
    if (sectorFlow) {
      await updateSession(phone, {
        sector: validAnswer,
        currentQuestionIndex: -1, // Réinitialiser pour commencer les questions du secteur
        answers: { ...state.answers, sector: validAnswer },
      });
      
      const { questions } = getQuestionsForFlow(undefined, validAnswer, config);
      await updateSession(phone, {
        metadata: {
          ...state.metadata,
          totalQuestions: questions.length,
        },
      });
      
      await sendMessage({ to: phone, body: "Parfait ! Je vais te poser quelques questions." });
      const refreshed = await getOrCreateSession(phone);
      await askNextQuestion(refreshed, config);
      return;
    } else {
      // Secteur non trouvé, utiliser les questions par défaut
      await updateSession(phone, {
        sector: validAnswer,
        currentQuestionIndex: -1,
        answers: { ...state.answers, sector: validAnswer },
      });
      const refreshed = await getOrCreateSession(phone);
      await askNextQuestion(refreshed, config);
      return;
    }
  }

  // Validate current question answer
  // Récupérer les questions selon le flow actif
  const { questions } = getQuestionsForFlow(state.formFlowId, state.sector, config);
  const currentQ = questions[state.currentQuestionIndex];
  
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

  clearReminder(phone);
  
  // Calculer le score de cette réponse
  const answerScore = scoreAnswer(currentQ.id, validAnswer, config, state);
  const answers = { ...state.answers, [currentQ.id]: validAnswer };
  const score = computeTotalScore({ ...state, answers }, config);
  
  // Créer l'historique de la réponse
  const answerHistory: AnswerHistory = {
    questionId: currentQ.id,
    questionLabel: currentQ.label,
    answer: validAnswer,
    timestamp: new Date().toISOString(),
    score: answerScore,
  };
  
  // Mettre à jour l'historique et les métadonnées
  const updatedAnswerHistory = [...state.answerHistory, answerHistory];
  const answeredQuestions = updatedAnswerHistory.length;
  const engagementLevel = calculateEngagementLevel(
    { ...state, answers, score, answerHistory: updatedAnswerHistory, metadata: { ...state.metadata, answeredQuestions } },
    config
  );
  
  // Récupérer les questions actives (sans celles à ignorer)
  const { questions: activeQuestions, skipQuestions } = getQuestionsForFlow(
    state.formFlowId,
    state.sector,
    config
  );
  const filteredQuestions = activeQuestions.filter(q => !shouldSkipQuestion(q.id, skipQuestions));
  
  // Mettre à jour la session avec toutes les nouvelles données
  await updateSession(phone, { 
    answers,
    score,
    answerHistory: updatedAnswerHistory,
    lastActivityAt: new Date().toISOString(),
    metadata: {
      ...state.metadata,
      totalQuestions: filteredQuestions.length,
      answeredQuestions,
      engagementLevel,
    },
  });
  
  const updatedState = await getOrCreateSession(phone);
  
  // Sauvegarder la réponse en temps réel
  await persistAnswer(phone, answerHistory, updatedState);

  // Vérifier si c'est la dernière question (en comptant seulement les questions non ignorées)
  const currentActiveIndex = filteredQuestions.findIndex(q => q.id === currentQ.id);
  if (currentActiveIndex >= filteredQuestions.length - 1) {
    // Dernière question répondue - prendre une décision automatique
    const decisionInfo = makeDecision(updatedState, config);
    await handleDecision(updatedState, config, decisionInfo.decision);
    return;
  }

  // Poser la question suivante
  await askNextQuestion(updatedState, config);
}
