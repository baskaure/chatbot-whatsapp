export type QuestionOption = string;

export interface QuestionConfig {
  id: string;
  label: string;
  options: QuestionOption[];
  scores: Record<QuestionOption, number>;
}

export interface BotConfig {
  welcome: string;
  start_keywords: string[];
  questions: QuestionConfig[];
  qualified_threshold: number;
  messages: {
    qualified_intro: string;
    calendly_link: string;
    disqualified: string;
    resource_link: string;
  };
  timeouts: {
    question_seconds: number;
    max_retries: number;
  };
}

export interface ConversationState {
  phone: string;
  startedAt: string;
  currentQuestionIndex: number;
  answers: Record<string, string>;
  score: number;
  status: "collecting" | "awaiting_preference" | "qualified" | "disqualified";
  calendlySent: boolean;
  resourceSent: boolean;
  calendlyPreference: string | null;
}

export interface IncomingMessage {
  id: string;
  from: string;
  body: string;
}

export interface OutgoingMessage {
  to: string;
  body: string;
}

