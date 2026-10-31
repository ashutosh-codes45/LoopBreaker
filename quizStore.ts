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
  setChapter: (chapter: string) => void;

  // Lifecycle
  view: 'setup' | 'quiz' | 'deepDive';
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
  submitAnswer: () => void;
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
  submitAnswer: () => {
    const {
      studentStates,
      currentQuestionIndex,
      questions,
      currentDifficulty,
      selectedAnswer,
      selectedConfidence,
    } = get();

    if (!selectedAnswer || !selectedConfidence) return;

    const currentQuestion = questions[currentQuestionIndex];
    const event: AttemptEvent = {
      student_id: initialStudentId,
      question_id: currentQuestion.id,
      concept_id: currentQuestion.concept_id,
      difficulty: currentDifficulty,
      correct: selectedAnswer === 'A', // placeholder; real correctness checked below
      confidence: selectedConfidence,
      timestamp: Date.now(),
    };

    // Determine correctness from the question data. Since questions.json doesn't
    // carry correct_option in the runtime type, we rely on the engine's schema.
    // For this UI we treat the selected option letter as the answer and compare
    // against the stored correct_option from the JSON source.
    const sourceQuestion = questionsData.find(
      (q: any) => q.id === currentQuestion.id
    );
    event.correct = selectedAnswer === (sourceQuestion?.correct_option ?? 'A');

    const stateMap: Record<string, ConceptState> = studentStates;
    // Convert record to Map for engine
    const map = new Map<string, ConceptState>();
    for (const [k, v] of Object.entries(stateMap)) {
      map.set(k, v);
    }

    const result = processAttempt(map, event, conceptGraph);

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
      loopFlag: result.loopFlag,
      rootGap: result.rootGap,
      isDeepDive: !!result.rootGap,
      currentDifficulty: nextDifficulty,
    });

    // Advance to next question
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex < questions.length) {
      set({
        currentQuestionIndex: nextIndex,
        selectedAnswer: null,
        selectedConfidence: null,
      });
    } else {
      set({ view: 'deepDive' });
    }
  },
}));