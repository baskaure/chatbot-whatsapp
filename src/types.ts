export type QuestionOption = string;

export interface QuestionConfig {
  id: string;
  label: string;
  options: QuestionOption[];
  scores: Record<QuestionOption, number>;
}

export interface DecisionRules {
  rdv: {
    minScore: number;
    conditions?: string[];
  };
  humain: {
    minScore: number;
    conditions?: string[];
  };
  nurturing: {
    minScore: number;
    maxScore: number;
    conditions?: string[];
  };
  sortie: {
    maxScore: number;
    conditions?: string[];
  };
}

export interface FormFlow {
  id: string;
  keyword: string; // Mot-clé qui déclenche ce flow (ex: "expert habitat")
  name: string; // Nom du formulaire (ex: "Expert Habitat")
  prefill_message: string; // Message pré-rempli avec le mot-clé
  questions: QuestionConfig[]; // Questions spécifiques à ce formulaire
  skip_questions?: string[]; // IDs de questions déjà posées dans le formulaire Facebook
}

export interface SectorFlow {
  sector: string; // Secteur d'activité (ex: "Coach", "Infopreneur")
  questions: QuestionConfig[]; // Questions pour ce secteur
}

export interface BotConfig {
  welcome: string;
  start_keywords: string[];
  questions: QuestionConfig[]; // Questions par défaut (legacy, pour compatibilité)
  qualified_threshold: number;
  decision_rules: DecisionRules;
  messages: {
    qualified_intro: string;
    calendly_link: string;
    disqualified: string;
    resource_link: string;
    rdv_message: string;
    humain_message: string;
    nurturing_message: string;
    sortie_message: string;
  };
  timeouts: {
    question_seconds: number;
    max_retries: number;
  };
  prefill_message?: {
    enabled: boolean;
    body: string;
  };
  // Nouveau système de flows
  form_flows?: FormFlow[]; // Flows avec mots-clés (venant de formulaires)
  sector_flows?: SectorFlow[]; // Flows par secteur (sans formulaire)
  default_sector_question?: QuestionConfig; // Question pour identifier le secteur
}

export type DecisionType = "rdv" | "humain" | "nurturing" | "sortie";

export interface AnswerHistory {
  questionId: string;
  questionLabel: string;
  answer: string;
  timestamp: string;
  score: number;
}

export interface ProspectProfile {
  phone: string;
  startedAt: string;
  lastActivityAt: string;
  answers: Record<string, string>;
  answerHistory: AnswerHistory[];
  score: number;
  status: "collecting" | "awaiting_preference" | "qualified" | "disqualified" | "completed";
  decision: DecisionType | null;
  decisionReason: string | null;
  calendlySent: boolean;
  resourceSent: boolean;
  calendlyPreference: string | null;
  metadata: {
    totalQuestions: number;
    answeredQuestions: number;
    averageResponseTime?: number;
    engagementLevel: "low" | "medium" | "high";
  };
}

export interface ConversationState extends ProspectProfile {
  currentQuestionIndex: number;
  formFlowId?: string; // ID du flow de formulaire actif
  sector?: string; // Secteur identifié (pour flows par secteur)
  detectedKeyword?: string; // Mot-clé détecté dans le premier message
}

export interface IncomingMessage {
  id: string;
  messageSid?: string;
  from: string;
  body: string;
}

export interface OutgoingMessage {
  to: string;
  body: string;
}

