import { CONFIG } from './config';
import {
  ConceptGraphItem,
  AttemptEvent,
  ConceptState,
  StudentStateMap,
  CycleError,
  Difficulty,
  Confidence,
} from './types';

export const MISCONCEPTION_SELF = 'misconception on this concept itself';

export interface ProcessResult {
  newStateMap: StudentStateMap;
  loopFlag: boolean;
  rootGap: string | null;
  reason: string;
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

const mapKey = (studentId: string, conceptId: string) => `${studentId}:${conceptId}`;

function updateStatus(state: ConceptState): ConceptState {
  const next = { ...state };
  if (next.attempts === 0) next.status = 'unseen';
  else if (next.clean_streak >= 3 && next.p_mastery >= 0.8) next.status = 'understood';
  else if (next.p_mastery >= 0.4) next.status = 'shaky';
  else next.status = 'weak';
  return next;
}

/** Throws CycleError if the prerequisite graph has a cycle. */
export function validateGraph(graph: ConceptGraphItem[]): void {
  const visited = new Set<string>();
  const stack = new Set<string>();
  const adjacency = new Map<string, string[]>();
  for (const item of graph) adjacency.set(item.id, item.prerequisites);

  function dfs(node: string): void {
    if (stack.has(node)) throw new CycleError(`Cycle detected at concept "${node}"`);
    if (visited.has(node)) return;
    visited.add(node);
    stack.add(node);
    for (const dep of adjacency.get(node) ?? []) dfs(dep);
    stack.delete(node);
  }
  for (const item of graph) dfs(item.id);
}

function getGuess(difficulty: Difficulty, confidence: Confidence): number {
  if (confidence === 'not_sure') return 0.5;
  if (difficulty === 'easy') return CONFIG.guessEasy;
  if (difficulty === 'hard') return CONFIG.guessHard;
  return CONFIG.guessMedium;
}

function getSlip(correct: boolean, confidence: Confidence): number {
  return !correct && confidence === 'sure' ? 0.05 : CONFIG.slipDefault;
}

function bayesianUpdate(p: number, correct: boolean, guess: number, slip: number): number {
  const posterior = correct
    ? (p * (1 - slip)) / (p * (1 - slip) + (1 - p) * guess)
    : (p * slip) / (p * slip + (1 - p) * (1 - guess));
  const learned = posterior + (1 - posterior) * CONFIG.pLearn;
  return Math.min(1, Math.max(0, learned));
}

/** Nearest weakest prerequisite (unseen counts as starting mastery). */
function findRootGap(
  studentId: string,
  conceptId: string,
  graph: ConceptGraphItem[],
  stateMap: StudentStateMap
): string | null {
  const byId = new Map(graph.map((c) => [c.id, c]));
  const ancestors: string[] = [];
  const seen = new Set<string>();
  const queue: string[] = [...(byId.get(conceptId)?.prerequisites ?? [])];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    ancestors.push(cur);
    queue.push(...(byId.get(cur)?.prerequisites ?? []));
  }
  if (ancestors.length === 0) return null;

  let lowest: string | null = null;
  let lowestP = Infinity;
  let anyWeak = false;
  for (const anc of ancestors) {
    const p = stateMap.get(mapKey(studentId, anc))?.p_mastery ?? CONFIG.startingPMastery;
    if (p < lowestP) {
      lowestP = p;
      lowest = anc;
    }
    if (p < 0.8) anyWeak = true;
  }
  return anyWeak ? lowest : MISCONCEPTION_SELF;
}

/** One pure update per answer. Throws on missing confidence or unknown concept. */
export function processAttempt(
  studentStateMap: StudentStateMap,
  event: AttemptEvent,
  graph: ConceptGraphItem[]
): ProcessResult {
  if (!event.confidence) throw new Error('confidence is missing in attempt event');
  if (!graph.some((c) => c.id === event.concept_id)) {
    throw new Error(`Unknown concept ID: ${event.concept_id}`);
  }

  const key = mapKey(event.student_id, event.concept_id);
  const prev = studentStateMap.get(key) ?? { ...INITIAL_STATE };

  const guess = getGuess(event.difficulty, event.confidence);
  const slip = getSlip(event.correct, event.confidence);
  const posterior = bayesianUpdate(prev.p_mastery, event.correct, guess, slip);

  // Very fast correct answers might be guesses: halve the gain.
  const isFast = event.time_ms !== undefined && event.time_ms < 3000;
  const nextP =
    event.correct && isFast ? prev.p_mastery + (posterior - prev.p_mastery) * 0.5 : posterior;

  const next: ConceptState = {
    ...prev,
    p_mastery: nextP,
    attempts: prev.attempts + 1,
    last_seen: event.timestamp,
  };

  let reason: string;
  if (event.correct) {
    next.wrong_streak = 0;
    const clean =
      event.confidence === 'sure' && (event.difficulty === 'medium' || event.difficulty === 'hard');
    next.clean_streak = clean ? prev.clean_streak + 1 : 0;
    reason = event.confidence === 'sure' ? 'correct and confident' : 'correct but unsure (shaky)';
  } else {
    next.wrong_streak = prev.wrong_streak + 1;
    next.clean_streak = 0;
    if (event.confidence === 'sure') {
      next.sure_wrong_count = prev.sure_wrong_count + 1;
      reason = 'misconception: wrong with high confidence';
    } else {
      reason = 'knowledge gap: wrong and unsure';
    }
  }

  const finalState = updateStatus(next);
  const newMap: StudentStateMap = new Map(studentStateMap);
  newMap.set(key, finalState);

  // Fires once per loop: on the 2nd wrong in a row, or the Nth confident wrong.
  const loopFlag =
    !event.correct &&
    (finalState.wrong_streak === 2 ||
      (event.confidence === 'sure' && finalState.sure_wrong_count === CONFIG.sureWrongWeight));

  const rootGap = findRootGap(event.student_id, event.concept_id, graph, newMap);
  return { newStateMap: newMap, loopFlag, rootGap, reason };
}

export const processAttemptInternal = processAttempt;

export function suggestDifficulty(state: ConceptState, current: Difficulty): Difficulty {
  if (state.clean_streak >= 2) {
    if (current === 'easy') return 'medium';
    if (current === 'medium') return 'hard';
  } else if (state.wrong_streak >= 1) {
    if (current === 'hard') return 'medium';
    if (current === 'medium') return 'easy';
  }
  return current;
}

export function getReport(
  studentStateMap: StudentStateMap,
  graph: ConceptGraphItem[],
  totalQuestionsAttempted: number,
  studentId?: string,
  chapter = 'Electricity'
): ReportResult {
  const conceptBreakdown = new Map<string, ConceptState>();
  const retake: ReportItem[] = [];
  let hasMisconception = false;
  let hasWeak = false;

  for (const [key, state] of studentStateMap.entries()) {
    const idx = key.indexOf(':');
    const sid = key.slice(0, idx);
    const cid = key.slice(idx + 1);
    if (studentId && sid !== studentId) continue;

    conceptBreakdown.set(cid, state);
    if (state.status === 'weak') hasWeak = true;

    if (state.status === 'weak' || state.status === 'shaky') {
      if (state.sure_wrong_count > 0) hasMisconception = true;
      const gap = findRootGap(sid, cid, graph, studentStateMap);
      retake.push({
        concept: cid,
        prerequisite: gap && gap !== MISCONCEPTION_SELF ? gap : null,
        chapter,
      });
    }
  }

  // Misconceptions first, then lowest mastery first.
  retake.sort((a, b) => {
    const sa = conceptBreakdown.get(a.concept)!;
    const sb = conceptBreakdown.get(b.concept)!;
    const ma = sa.sure_wrong_count > 0 ? 0 : 1;
    const mb = sb.sure_wrong_count > 0 ? 0 : 1;
    if (ma !== mb) return ma - mb;
    return sa.p_mastery - sb.p_mastery;
  });

  return {
    conceptBreakdown,
    priority: hasMisconception ? 'misconception' : hasWeak ? 'gap' : null,
    retake,
    earlyEstimate: totalQuestionsAttempted < 10,
  };
}