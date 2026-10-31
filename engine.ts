import { CONFIG } from './config';
import {
  ConceptGraphItem,
  AttemptEvent,
  ConceptState,
  StudentStateMap,
  CycleError,
} from './types';

export interface ProcessResult {
  newStateMap: StudentStateMap;
  loopFlag: boolean;
  rootGap: string | null;
}

export interface ReportItem {
  concept: string;
  prerequisite: string | null;
  chapter: string;
}

export interface ReportResult {
  conceptBreakdown: Map<string, ConceptState>;
  priority: 'misconception' | 'gap' | null;
  retake: ReportItem[];
  earlyEstimate: boolean;
}

const INITIAL_STATE: ConceptState = {
  p_mastery: CONFIG.startingPMastery,
  attempts: 0,
  wrong_streak: 0,
  clean_streak: 0,
  sure_wrong_count: 0,
  last_seen: 0,
  status: 'unseen',
};

const PROCESSED_KEY = '__processed__';

function cloneStateMap(map: StudentStateMap): StudentStateMap {
  const result = new Map<string, ConceptState>();
  for (const [key, state] of map.entries()) {
    result.set(key, { ...state });
  }
  return result;
}

function mapKey(studentId: string, conceptId: string): string {
  return `${studentId}:${conceptId}`;
}

function getOrCreateState(
  map: StudentStateMap,
  studentId: string,
  conceptId: string
): ConceptState {
  const key = mapKey(studentId, conceptId);
  const existing = map.get(key);
  if (existing) return existing;
  const initial = { ...INITIAL_STATE };
  map.set(key, initial);
  return initial;
}

function getProcessedQuestions(map: StudentStateMap, studentId: string): Set<string> {
  const key = `${PROCESSED_KEY}:${studentId}`;
  const val = map.get(key);
  if (val && typeof val === 'string') {
    // legacy fallback – shouldn't happen
    return new Set(JSON.parse(val));
  }
  // We store processed sets under a special key conceptually, but since map values are ConceptState,
  // we keep a parallel WeakMap instead.
  return new Set();
}

// Since Map values are ConceptState only, we keep processed sets in a WeakMap for purity.
const processedSets = new WeakMap<StudentStateMap, Map<string, Set<string>>>();

function getProcessedSet(map: StudentStateMap, studentId: string): Set<string> {
  let perStudent = processedSets.get(map);
  if (!perStudent) {
    perStudent = new Map();
    processedSets.set(map, perStudent);
  }
  let set = perStudent.get(studentId);
  if (!set) {
    set = new Set();
    perStudent.set(studentId, set);
  }
  return set;
}

function updateStatus(state: ConceptState): ConceptState {
  const next: ConceptState = { ...state };
  if (next.attempts === 0) {
    next.status = 'unseen';
  } else if (next.clean_streak >= 3 && next.p_mastery >= 0.8) {
    next.status = 'understood';
  } else if (next.p_mastery >= 0.4) {
    next.status = 'shaky';
  } else {
    next.status = 'weak';
  }
  return next;
}

/**
 * Detect cycles in a directed graph of concepts.
 * Throws CycleError if a cycle exists.
 */
export function validateGraph(graph: ConceptGraphItem[]): void {
  const visited = new Set<string>();
  const stack = new Set<string>();
  const adjacency = new Map<string, string[]>();
  for (const item of graph) {
    adjacency.set(item.id, item.prerequisites);
  }

  function dfs(node: string): void {
    if (stack.has(node)) throw new CycleError(`Cycle detected at concept "${node}"`);
    if (visited.has(node)) return;
    visited.add(node);
    stack.add(node);
    const deps = adjacency.get(node) ?? [];
    for (const dep of deps) {
      dfs(dep);
    }
    stack.delete(node);
  }

  for (const item of graph) {
    dfs(item.id);
  }
}

/**
 * Get guess probability based on difficulty and confidence.
 */
function getGuess(difficulty: 'easy' | 'medium' | 'hard', confidence: 'sure' | 'not_sure'): number {
  if (confidence === 'not_sure') return 0.5;
  switch (difficulty) {
    case 'easy': return CONFIG.guessEasy;
    case 'medium': return CONFIG.guessMedium;
    case 'hard': return CONFIG.guessHard;
    default: return CONFIG.guessMedium;
  }
}

/**
 * Get slip probability based on correctness and confidence.
 */
function getSlip(correct: boolean, confidence: 'sure' | 'not_sure'): number {
  if (!correct && confidence === 'sure') return 0.05;
  return CONFIG.slipDefault;
}

/**
 * Core BKT-style update.
 */
function bayesianUpdate(p: number, correct: boolean, guess: number, slip: number): number {
  const posterior = correct
    ? (p * (1 - slip)) / (p * (1 - slip) + (1 - p) * guess)
    : (p * slip) / (p * slip + (1 - p) * (1 - guess));
  const learned = posterior + (1 - posterior) * CONFIG.pLearn;
  return Math.min(1, Math.max(0, learned));
}

/**
 * Process a single attempt event immutably.
 * Throws if confidence missing, concept unknown, or duplicate question in session.
 */
export function processAttempt(
  studentStateMap: StudentStateMap,
  event: AttemptEvent,
  graph: ConceptGraphItem[]
): ProcessResult {
  if (!event.confidence) throw new Error('confidence is missing in attempt event');

  const conceptExists = graph.some((c) => c.id === event.concept_id);
  if (!conceptExists) throw new Error(`Unknown concept ID: ${event.concept_id}`);

  // Duplicate question detection per student
  const processed = getProcessedSet(studentStateMap, event.student_id);
  if (processed.has(event.question_id)) {
    throw new Error(`Duplicate question ID "${event.question_id}" for student ${event.student_id}`);
  }

  const newMap = cloneStateMap(studentStateMap);

  const state = getOrCreateState(newMap, event.student_id, event.concept_id);

  const timeMs = event.time_ms ?? Infinity;
  const isFast = timeMs < 3000;

  const guess = getGuess(event.difficulty, event.confidence);
  const slip = getSlip(event.correct, event.confidence);

  const posterior = bayesianUpdate(state.p_mastery, event.correct, guess, slip);

  // Apply fast-answer discount (halve mastery gain)
  const nextP = isFast ? state.p_mastery + (posterior - state.p_mastery) * 0.5 : posterior;

  const nextState: ConceptState = {
    ...state,
    p_mastery: nextP,
    attempts: state.attempts + 1,
    last_seen: event.timestamp,
  };

  if (event.correct) {
    nextState.wrong_streak = 0;
    if (
      event.confidence === 'sure' &&
      (event.difficulty === 'medium' || event.difficulty === 'hard')
    ) {
      nextState.clean_streak = state.clean_streak + 1;
    } else {
      nextState.clean_streak = 0;
    }
  } else {
    nextState.wrong_streak = state.wrong_streak + 1;
    if (event.confidence === 'sure') {
      nextState.sure_wrong_count = state.sure_wrong_count + 1;
      nextState.clean_streak = 0;
    } else {
      nextState.clean_streak = 0;
    }
  }

  const finalState = updateStatus(nextState);
  newMap.set(mapKey(event.student_id, event.concept_id), finalState);

  // Mark question as processed for this student
  processed.add(event.question_id);

  // Loop flag
  const loopFlag =
    finalState.wrong_streak >= 2 ||
    (event.confidence === 'sure' && finalState.sure_wrong_count >= CONFIG.sureWrongWeight);

  // Root gap identification
  const rootGap = findRootGap(event.student_id, event.concept_id, graph, newMap);

  return { newStateMap: newMap, loopFlag, rootGap };
}

/**
 * Find prerequisite with lowest mastery (unseen counts as lowest).
 * If all prerequisites >= 0.8, returns "misconception on this concept itself".
 */
function findRootGap(
  studentId: string,
  conceptId: string,
  graph: ConceptGraphItem[],
  stateMap: StudentStateMap
): string | null {
  const ancestors: string[] = [];
  const seen = new Set<string>();
  const queue: string[] = [];

  const directDeps = graph.find((c) => c.id === conceptId)?.prerequisites ?? [];
  for (const dep of directDeps) {
    if (!seen.has(dep)) {
      seen.add(dep);
      queue.push(dep);
      ancestors.push(dep);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const deps = graph.find((c) => c.id === current)?.prerequisites ?? [];
    for (const dep of deps) {
      if (!seen.has(dep)) {
        seen.add(dep);
        queue.push(dep);
        ancestors.push(dep);
      }
    }
  }

  if (ancestors.length === 0) return null;

  let lowestConcept: string | null = null;
  let lowestMastery = Infinity;
  let anyBelowZeroEight = false;

  for (const anc of ancestors) {
    const key = `${studentId}:${anc}`;
    let mastery = Infinity;
    const st = stateMap.get(key);
    if (st) {
      mastery = st.p_mastery;
    } else {
      mastery = CONFIG.startingPMastery;
    }
    if (mastery < lowestMastery) {
      lowestMastery = mastery;
      lowestConcept = anc;
    }
    if (mastery < 0.8) anyBelowZeroEight = true;
  }

  if (!anyBelowZeroEight) return 'misconception on this concept itself';
  return lowestConcept;
}

/**
 * Alias retained for compatibility with tests.
 */
export const processAttemptInternal = processAttempt;

/**
 * Suggest difficulty for next question.
 * Starts at medium. Steps up after 2 clean correct answers, steps down after 1 wrong answer.
 * Bounded within easy/medium/hard.
 */
export function suggestDifficulty(
  state: ConceptState,
  currentDifficulty: 'easy' | 'medium' | 'hard'
): 'easy' | 'medium' | 'hard' {
  let difficulty = currentDifficulty;
  if (state.clean_streak >= 2) {
    if (difficulty === 'easy') difficulty = 'medium';
    else if (difficulty === 'medium') difficulty = 'hard';
  } else if (state.wrong_streak >= 1) {
    if (difficulty === 'hard') difficulty = 'medium';
    else if (difficulty === 'medium') difficulty = 'easy';
  }
  return difficulty;
}

/**
 * Compile overall concept breakdown, tracking priority (misconception > gap).
 * Outputs retake array of { concept, prerequisite, chapter }.
 * Quizzes with <10 total questions flagged as "early estimate".
 */
export function getReport(
  studentStateMap: StudentStateMap,
  graph: ConceptGraphItem[],
  totalQuestionsAttempted: number
): ReportResult {
  const conceptBreakdown = new Map<string, ConceptState>(studentStateMap);

  let priority: 'misconception' | 'gap' | null = null;
  for (const state of conceptBreakdown.values()) {
    if (state.sure_wrong_count > 0) {
      priority = 'misconception';
      break;
    }
    if (state.wrong_streak >= 2 && priority !== 'misconception') {
      priority = 'gap';
    }
  }

  const retake: ReportItem[] = [];
  const earlyEstimate = totalQuestionsAttempted < 10;

  for (const [key, state] of conceptBreakdown.entries()) {
    const [studentId, conceptId] = key.split(':');
    if (!studentId || !conceptId) continue;
    if (
      state.status === 'weak' ||
      state.status === 'shaky' ||
      state.sure_wrong_count > 0 ||
      state.wrong_streak >= 2
    ) {
      const chapter = graph.find((c) => c.id === conceptId)?.name ?? 'Unknown';
      const prerequisite = findRootGap(studentId, conceptId, graph, conceptBreakdown);
      retake.push({ concept: conceptId, prerequisite: prerequisite ?? null, chapter });
    }
  }

  return { conceptBreakdown, priority, retake, earlyEstimate };
}