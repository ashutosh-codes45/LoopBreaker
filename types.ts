import { CycleError } from './types';

export interface ConceptGraphItem {
  id: string;
  name: string;
  prerequisites: string[];
}

export interface Question {
  id: string;
  concept_id: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface AttemptEvent {
  student_id: string;
  question_id: string;
  concept_id: string;
  difficulty: 'easy' | 'medium' | 'hard';
  correct: boolean;
  confidence: 'sure' | 'not_sure';
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