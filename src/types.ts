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

export interface BotConfig {
  welcome: string;
  start_keywords: string[];
  questions: QuestionConfig[];
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

