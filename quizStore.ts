import { create } from 'zustand';
import { AttemptEvent, ConceptGraphItem, ConceptState, Difficulty, Question } from './types';
import {
  suggestDifficulty,
  processAttempt,
  validateGraph,
  getReport,
  MISCONCEPTION_SELF,
  ReportResult,
} from './engine';
import questionsData from './questions.json';
import conceptData from './concept.json';

export const CHAPTER = 'Electricity';
const STUDENT_ID = 'student-1';
const DEEP_DIVE_SIZE = 3;
const DIFF_ORDER: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

// concept.json uses ID / Instance name / Prerequisites, so normalize it.
export const conceptGraph: ConceptGraphItem[] = (conceptData as any[]).map((c) => ({
  id: c.ID ?? c.id,
  name: c['Instance name'] ?? c.name,
  prerequisites: c.Prerequisites ?? c.prerequisites ?? [],
}));
const validIds = new Set(conceptGraph.map((c) => c.id));
export const allQuestions: Question[] = (questionsData as unknown as Question[]).filter((q) =>
  validIds.has(q.concept_id)
);
console.log('questions loaded:', allQuestions.length, 'of', (questionsData as any[]).length);

export const conceptName = (id: string | null) =>
  conceptGraph.find((c) => c.id === id)?.name ?? id ?? '';

const sKey = (conceptId: string) => `${STUDENT_ID}:${conceptId}`;

export interface StrugglePoint {
  id: string;
  conceptId: string;
  rootGapConcept: string | null;
  reason: string;
  timestamp: number;
}

type View = 'setup' | 'quiz' | 'why' | 'report';

interface QuizState {
  view: View;
  quizLength: 5 | 10 | 15;
  setQuizLength: (len: 5 | 10 | 15) => void;

  pool: Question[];
  usedIds: string[];
  currentQuestion: Question | null;
  questionStartedAt: number;
  mainAnswered: number;
  deepAnswered: number;

  selectedAnswer: string | null;
  selectedConfidence: 'sure' | 'not_sure' | null;
  selectAnswer: (option: string) => void;
  selectConfidence: (c: 'sure' | 'not_sure') => void;

  currentDifficulty: Difficulty;
  studentStates: Record<string, ConceptState>;

  pendingLoop: { conceptId: string; rootGap: string | null; wrongOption: string } | null;
  inDeepDive: boolean;
  deepQueue: Question[];
  deepDiveTarget: string | null;
  strugglePoints: StrugglePoint[];

  startQuiz: (focusConceptIds?: string[]) => void;
  submitAnswer: () => void;
  submitWhy: (reason: string) => void;
  advance: () => void;
  resetQuiz: () => void;
  getReportData: () => ReportResult;
}

function pickNext(
  pool: Question[],
  usedIds: string[],
  difficulty: Difficulty,
  states: Record<string, ConceptState>
): Question | null {
  const unused = pool.filter((q) => !usedIds.includes(q.id));
  if (unused.length === 0) return null;
  const attemptsOf = (q: Question) => states[sKey(q.concept_id)]?.attempts ?? 0;
  const sameDiff = unused.filter((q) => q.difficulty === difficulty);
  const candidates = sameDiff.length ? sameDiff : unused;
  const min = Math.min(...candidates.map(attemptsOf));
  const least = candidates.filter((q) => attemptsOf(q) === min);
  return least[Math.floor(Math.random() * least.length)];
}

const freshState = {
  view: 'setup' as View,
  pool: [] as Question[],
  usedIds: [] as string[],
  currentQuestion: null as Question | null,
  questionStartedAt: 0,
  mainAnswered: 0,
  deepAnswered: 0,
  selectedAnswer: null as string | null,
  selectedConfidence: null as 'sure' | 'not_sure' | null,
  currentDifficulty: 'medium' as Difficulty,
  studentStates: {} as Record<string, ConceptState>,
  pendingLoop: null,
  inDeepDive: false,
  deepQueue: [] as Question[],
  deepDiveTarget: null as string | null,
  strugglePoints: [] as StrugglePoint[],
};

export const useQuizStore = create<QuizState>((set, get) => ({
  ...freshState,
  quizLength: 10,
  setQuizLength: (len) => set({ quizLength: len }),

  selectAnswer: (option) => set({ selectedAnswer: option }),
  selectConfidence: (c) => set({ selectedConfidence: c }),

  startQuiz: (focusConceptIds) => {
    let pool = allQuestions;
    if (focusConceptIds && focusConceptIds.length) {
      const focused = allQuestions.filter((q) => focusConceptIds.includes(q.concept_id));
      if (focused.length) pool = focused;
    }
    const first = pickNext(pool, [], 'medium', {});
    set({
      ...freshState,
      pool,
      view: first ? 'quiz' : 'setup',
      currentQuestion: first,
      usedIds: first ? [first.id] : [],
      questionStartedAt: Date.now(),
    });
  },

  submitAnswer: () => {
    const s = get();
    const q = s.currentQuestion;
    if (!q || !s.selectedAnswer || !s.selectedConfidence) return;

    const correct = s.selectedAnswer === q.correct_option;
    const event: AttemptEvent = {
      student_id: STUDENT_ID,
      question_id: q.id,
      concept_id: q.concept_id,
      difficulty: q.difficulty,
      correct,
      confidence: s.selectedConfidence,
      time_ms: Date.now() - s.questionStartedAt,
      timestamp: Date.now(),
    };

    const map = new Map<string, ConceptState>(Object.entries(s.studentStates));
    const result = processAttempt(map, event, conceptGraph);
    const states = Object.fromEntries(result.newStateMap) as Record<string, ConceptState>;
    const conceptState = result.newStateMap.get(sKey(q.concept_id))!;

    const base = {
      studentStates: states,
      currentDifficulty: suggestDifficulty(conceptState, s.currentDifficulty),
      mainAnswered: s.mainAnswered + (s.inDeepDive ? 0 : 1),
      deepAnswered: s.deepAnswered + (s.inDeepDive ? 1 : 0),
      selectedAnswer: null,
      selectedConfidence: null,
    };

    if (result.loopFlag && !s.inDeepDive) {
      set({
        ...base,
        view: 'why',
        pendingLoop: {
          conceptId: q.concept_id,
          rootGap: result.rootGap,
          wrongOption: s.selectedAnswer,
        },
      });
      return;
    }
    set(base);
    get().advance();
  },

  submitWhy: (reason) => {
    const s = get();
    const p = s.pendingLoop;
    if (!p) return;

    const target =
      p.rootGap && p.rootGap !== MISCONCEPTION_SELF ? p.rootGap : p.conceptId;
    const pickFor = (conceptId: string) =>
      allQuestions
        .filter((q) => q.concept_id === conceptId && !s.usedIds.includes(q.id))
        .sort((a, b) => DIFF_ORDER[a.difficulty] - DIFF_ORDER[b.difficulty])
        .slice(0, DEEP_DIVE_SIZE);

    let picks = pickFor(target);
    let usedTarget = target;
    if (picks.length === 0 && target !== p.conceptId) {
      picks = pickFor(p.conceptId);
      usedTarget = p.conceptId;
    }

    set({
      strugglePoints: [
        ...s.strugglePoints,
        {
          id: `sp_${Date.now()}`,
          conceptId: p.conceptId,
          rootGapConcept: p.rootGap && p.rootGap !== MISCONCEPTION_SELF ? p.rootGap : null,
          reason,
          timestamp: Date.now(),
        },
      ],
      pendingLoop: null,
      inDeepDive: picks.length > 0,
      deepQueue: picks,
      deepDiveTarget: picks.length > 0 ? usedTarget : null,
    });
    get().advance();
  },

  advance: () => {
    const s = get();
    if (s.inDeepDive && s.deepQueue.length > 0) {
      const [next, ...rest] = s.deepQueue;
      set({
        view: 'quiz',
        currentQuestion: next,
        deepQueue: rest,
        usedIds: [...s.usedIds, next.id],
        questionStartedAt: Date.now(),
      });
      return;
    }
    if (s.mainAnswered >= s.quizLength) {
      set({ view: 'report', inDeepDive: false, deepDiveTarget: null, currentQuestion: null });
      return;
    }
    const next = pickNext(s.pool, s.usedIds, s.currentDifficulty, s.studentStates);
    if (!next) {
      set({ view: 'report', inDeepDive: false, deepDiveTarget: null, currentQuestion: null });
      return;
    }
    set({
      view: 'quiz',
      inDeepDive: false,
      deepDiveTarget: null,
      currentQuestion: next,
      usedIds: [...s.usedIds, next.id],
      questionStartedAt: Date.now(),
    });
  },

  resetQuiz: () => set({ ...freshState }),

  getReportData: () => {
    const s = get();
    const map = new Map<string, ConceptState>(Object.entries(s.studentStates));
    return getReport(map, conceptGraph, s.mainAnswered, STUDENT_ID, CHAPTER);
  },
}));