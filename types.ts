export type Difficulty = 'easy' | 'medium' | 'hard';
export type Confidence = 'sure' | 'not_sure';

export interface ConceptGraphItem {
  id: string;
  name: string;
  prerequisites: string[];
}

export interface Question {
  id: string;
  concept_id: string;
  difficulty: Difficulty;
  question_text: string;
  options: Record<string, string>;
  correct_option: string;
  misconceptions?: Record<string, string>;
}

export interface AttemptEvent {
  student_id: string;
  question_id: string;
  concept_id: string;
  difficulty: Difficulty;
  correct: boolean;
  confidence: Confidence;
  time_ms?: number;
  timestamp: number;
}

export interface ConceptState {
  p_mastery: number;
  attempts: number;
  wrong_streak: number;
  clean_streak: number;
  sure_wrong_count: number;
  last_seen: number;
  status: 'unseen' | 'weak' | 'shaky' | 'understood';
}

export class CycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CycleError';
  }
}

export type StudentStateMap = Map<string, ConceptState>;