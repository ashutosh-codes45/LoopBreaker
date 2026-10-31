import { create } from 'zustand';
import {
  AttemptEvent,
  ConceptGraphItem,
  ConceptState,
  Question,
} from './types';
import {
  suggestDifficulty,
  processAttempt,
  validateGraph,
} from './engine';
import questionsData from './questions.json';
import conceptGraphData from './concept.json';

const questions: Question[] = questionsData as unknown as Question[];
const conceptGraph: ConceptGraphItem[] = conceptGraphData as unknown as ConceptGraphItem[];

validateGraph(conceptGraph);

interface QuizState {
  // Setup
  chapter: string;
  quizLength: 5 | 10 | 15;
  setQuizLength: (len: 5 | 10 | 15) => void;
  setChapter: (chapter) => void;

  // Lifecycle
  view: 'setup' | 'quiz' | 'deepDive' | 'loopBreak';
  startQuiz: () => void;
  resetQuiz: () => void;

  // Quiz data
  questions: Question[];
  currentQuestionIndex: number;
  totalQuestions: number;

  // Selections
  selectedAnswer: string | null;
  selectedConfidence: 'sure' | 'not_sure' | null;
  selectAnswer: (option: string) => void;
  selectConfidence: (conf: 'sure' | 'not_sure') => void;
  clearSelections: () => void;

  // Engine integration
  currentDifficulty: 'easy' | 'medium' | 'hard';
  studentStates: Record<string, ConceptState>;
  loopFlag: boolean;
  rootGap: string | null;
  isDeepDive: boolean;
  isLoopBreak: boolean;
  strugglePoints: Array<{
    conceptId: string;
    rootGapConcept: string | null;
    reason: string;
    timeSpentMs: number;
    timestamp: number;
    studentId: string;
  }>;
  submitAnswer: () => void;
  recordStrugglePoint: (reason: string, timeSpentMs?: number) => void;
  completeLoopBreak: () => void;
}

/**
 * Maps option letters to human-friendly misconception descriptions
 * based on the misconceptions stored in questions.json
 */
function getMisconceptionReasons(
  conceptId: string,
  selectedOption: string
): Array<{ label: string; value: string }> {
  const sourceQuestion = questionsData.find(
    (q: any) => q.concept_id === conceptId
  );
  if (!sourceQuestion?.misconceptions) {
    return [
      { label: 'Calculation error', value: 'Calculation error' },
      { label: 'Misunderstood formula', value: 'Misunderstood formula' },
      { label: 'Confused terms', value: 'Confused terms' },
      { label: 'Other', value: 'Other' },
    ];
  }

  const optionMisconceptions = sourceQuestion.misconceptions;
  const reason = optionMisconceptions[selectedOption as keyof typeof optionMisconceptions];

  if (reason) {
    // Return the specific misconception plus fallback options
    return [
      { label: reason, value: reason },
      { label: 'Calculation error', value: 'Calculation error' },
      { label: 'Misunderstood formula', value: 'Misunderstood formula' },
      { label: 'Confused terms', value: 'Confused terms' },
      { label: 'Other', value: 'Other' },
    ];
  }

  // Generic fallbacks
  return [
    { label: 'Calculation error', value: 'Calculation error' },
    { label: 'Misunderstood formula', value: 'Misunderstood formula' },
    { label: 'Confused terms', value: 'Confused terms' },
    { label: 'Other', value: 'Other' },
  ];
}

const initialStudentId = 'student-1';

export const useQuizStore = create<QuizState>((set, get) => ({
  // Setup
  chapter: 'Electricity',
  quizLength: 10,
  setQuizLength: (len) => set({ quizLength: len }),
  setChapter: (chapter) => set({ chapter }),

  // Lifecycle
  view: 'setup',
  startQuiz: () => {
    const { quizLength } = get();
    const shuffled = [...questions].sort(() => 0.5 - Math.random());
    set({
      view: 'quiz',
      questions: shuffled.slice(0, quizLength),
      currentQuestionIndex: 0,
      totalQuestions: quizLength,
      selectedAnswer: null,
      selectedConfidence: null,
      currentDifficulty: 'medium',
      studentStates: {},
      loopFlag: false,
      rootGap: null,
      isDeepDive: false,
      isLoopBreak: false,
      strugglePoints: [],
    });
  },
  resetQuiz: () => {
    set({
      view: 'setup',
      questions: [],
      currentQuestionIndex: 0,
      totalQuestions: 0,
      selectedAnswer: null,
      selectedConfidence: null,
      currentDifficulty: 'medium',
      studentStates: {},
      loopFlag: false,
      rootGap: null,
      isDeepDive: false,
      isLoopBreak: false,
      strugglePoints: [],
    });
  },

  // Quiz data
  questions: [],
  currentQuestionIndex: 0,
  totalQuestions: 0,

  // Selections
  selectedAnswer: null,
  selectedConfidence: null,
  selectAnswer: (option) => set({ selectedAnswer: option }),
  selectConfidence: (conf) => set({ selectedConfidence: conf }),
  clearSelections: () =>
    set({ selectedAnswer: null, selectedConfidence: null }),

  // Engine integration
  currentDifficulty: 'medium',
  studentStates: {},
  loopFlag: false,
  rootGap: null,
  isDeepDive: false,
  isLoopBreak: false,
  strugglePoints: [],
  submitAnswer: () => {
    const {
      studentStates,
      currentQuestionIndex,
      questions,
      currentDifficulty,
      selectedAnswer,
      selectedConfidence,
      loopFlag,
      isLoopBreak,
      strugglePoints,
    } = get();

    if (!selectedAnswer || !selectedConfidence) return;

    const currentQuestion = questions[currentQuestionIndex];
    const event: AttemptEvent = {
      student_id: initialStudentId,
      question_id: currentQuestion.id,
      concept_id: currentQuestion.concept_id,
      difficulty: currentDifficulty,
      correct: selectedAnswer === 'A', // placeholder
      confidence: selectedConfidence,
      timestamp: Date.now(),
    };

    // Determine correctness from the question data
    const sourceQuestion = questionsData.find(
      (q: any) => q.id === currentQuestion.id
    );
    event.correct = selectedAnswer === (sourceQuestion?.correct_option ?? 'A');

    const stateMap: Record<string, ConceptState> = studentStates;
    const map = new Map<string, ConceptState>();
    for (const [k, v] of Object.entries(stateMap)) {
      map.set(k, v);
    }

    const result = processAttempt(map, event, conceptGraph);

    // *** LOOP BREAKER INTEGRATION ***
    // Check if a loop was triggered
    const newLoopFlag = result.loopFlag || isLoopBreak;
    const newStrugglePoints = [...strugglePoints];

    if (newLoopFlag && !isLoopBreak) {
      // Enter loop break mode - pause the quiz length counter
      // The questions answered during loop break won't count toward quiz length
      set({
        loopFlag: newLoopFlag,
        rootGap: result.rootGap,
        isLoopBreak: true,
        isDeepDive: false,
        // Keep current selections but mark as in-loop-break
        selectedAnswer: selectedAnswer,
        selectedConfidence: selectedConfidence,
      });

      // Record a struggle point immediately upon loop entry
      const misconceptionReasons = getMisconceptionReasons(
        currentQuestion.concept_id,
        selectedAnswer
      );
      newStrugglePoints.push({
        conceptId: currentQuestion.concept_id,
        rootGapConcept: result.rootGap,
        reason: misconceptionReasons[0]?.label || 'Misunderstood formula',
        timeSpentMs: 0, // Will be updated when loop break completes
        timestamp: Date.now(),
        studentId: initialStudentId,
      });
    }

    // Update student states from engine
    const newStudentStates: Record<string, ConceptState> = {};
    result.newStateMap.forEach((v, k) => {
      newStudentStates[k] = v;
    });

    const nextDifficulty = suggestDifficulty(
      result.newStateMap.get(`${initialStudentId}:${currentQuestion.concept_id}`)!,
      currentDifficulty
    );

    set({
      studentStates: newStudentStates,
      loopFlag: newLoopFlag,
      rootGap: result.rootGap,
      currentDifficulty: nextDifficulty,
    });

    // If we're in loop break mode, stay on same question, don't advance
    let nextIndex = currentQuestionIndex;
    if (!isLoopBreak && !newLoopFlag) {
      // Normal advancement
      nextIndex = currentQuestionIndex + 1;
    }
    // If loopBreak is true, we stay on the same question index

    if (nextIndex < questions.length) {
      set({
        currentQuestionIndex: nextIndex,
        selectedAnswer: null,
        selectedConfidence: null,
        // isLoopBreak remains true until completedLoopBreak is called
      });
    } else if (nextIndex >= questions.length && !isLoopBreak) {
      set({ view: 'deepDive' });
    }
    // If loopBreak and at end, stay in loopBreak view

    return { newStateMap: map, loopFlag: newLoopFlag, rootGap: result.rootGap };
  },

  // *** RECORD STRUGGLE POINT ***
  recordStrugglePoint: (reason: string, timeSpentMs?: number) =>
    set((state) => {
      const newStrugglePoints = [...state.strugglePoints, {
        conceptId: state.rootGap || 'unknown',
        rootGapConcept: state.rootGap,
        reason,
        timeSpentMs: timeSpentMs || 0,
        timestamp: Date.now(),
        studentId: initialStudentId,
      }];
      return { strugglePoints: newStrugglePoints };
    }),

  // *** COMPLETE LOOP BREAK ***
  completeLoopBreak: () => set({ isLoopBreak: false, loopFlag: false }),

  // Deep dive
  isDeepDive: false,
}));