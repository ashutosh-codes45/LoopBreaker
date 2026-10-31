import { describe, it, expect } from 'vitest';
import { CONFIG } from './config';
import {
  ConceptGraphItem,
  AttemptEvent,
  ConceptState,
  StudentStateMap,
  CycleError,
} from './types';
import {
  validateGraph,
  processAttemptInternal,
  suggestDifficulty,
  getReport,
} from './engine';

function createTestGraph(): ConceptGraphItem[] {
  return [
    { id: 'charge', name: 'Electric Charge', prerequisites: [] },
    { id: 'current', name: 'Electric Current', prerequisites: ['charge'] },
    { id: 'voltage', name: 'Electric Potential (Voltage)', prerequisites: ['charge'] },
    { id: 'ohms_law', name: "Ohm's Law", prerequisites: ['current', 'voltage'] },
    { id: 'resistance', name: 'Electrical Resistance', prerequisites: ['current'] },
    { id: 'series', name: 'Series Resistors', prerequisites: ['resistance', 'ohms_law'] },
    { id: 'parallel', name: 'Parallel Resistors', prerequisites: ['resistance', 'ohms_law'] },
  ];
}

function createAttempt(
  studentId: string,
  conceptId: string,
  correct: boolean,
  confidence: 'sure' | 'not_sure',
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  timeMs = 5000,
  timestamp = Date.now()
): AttemptEvent {
  return {
    student_id: studentId,
    question_id: `q_${conceptId}_${timestamp}`,
    concept_id: conceptId,
    difficulty,
    correct,
    confidence,
    time_ms: timeMs,
    timestamp,
  };
}

describe('Mastery Engine', () => {
  let graph: ConceptGraphItem[];
  const studentId = 'student1';

  beforeEach(() => {
    graph = createTestGraph();
    validateGraph(graph);
  });

  // Test 1: 3 clean correct answers yields understood status
  it('3 clean correct answers yields understood status', () => {
    const conceptId = 'ohms_law';
    let state: StudentStateMap = new Map();
    for (let i = 0; i < 3; i++) {
      const event = createAttempt(studentId, conceptId, true, 'sure', 'medium', 5000);
      const result = processAttemptInternal(state, event, graph);
      state = result.newStateMap;
      expect(result.loopFlag).toBe(false);
    }
    const finalState = state.get(`${studentId}:${conceptId}`)!;
    expect(finalState.status).toBe('understood');
    expect(finalState.p_mastery).toBeGreaterThanOrEqual(0.8);
    expect(finalState.clean_streak).toBe(3);
  });

  // Test 2: 3 correct + 'not_sure' answers keeps status at shaky or weak (not understood)
  it('3 correct not_sure answers keeps status at shaky or weak', () => {
    const conceptId = 'ohms_law';
    let state: StudentStateMap = new Map();
    for (let i = 0; i < 3; i++) {
      const event = createAttempt(studentId, conceptId, true, 'not_sure', 'medium', 5000);
      const result = processAttemptInternal(state, event, graph);
      state = result.newStateMap;
    }
    const finalState = state.get(`${studentId}:${conceptId}`)!;
    expect(finalState.status).not.toBe('understood');
    expect(['weak', 'shaky']).toContain(finalState.status);
  });

  // Test 3: Wrong + Sure causes a significantly larger drop than Wrong + Not sure
  it('Wrong + Sure causes larger drop than Wrong + Not sure', () => {
    const conceptId = 'resistance';
    const highState: ConceptState = {
      p_mastery: 0.9,
      attempts: 10,
      wrong_streak: 0,
      clean_streak: 3,
      sure_wrong_count: 0,
      last_seen: Date.now(),
      status: 'understood',
    };
    const baseState: StudentStateMap = new Map<string, ConceptState>();
    baseState.set(`${studentId}:${conceptId}`, highState);

    const eventSure = createAttempt(studentId, conceptId, false, 'sure', 'medium', 5000);
    const resultSure = processAttemptInternal(baseState, eventSure, graph);
    const masterySure = resultSure.newStateMap.get(`${studentId}:${conceptId}`)!.p_mastery;

    const eventNotSure = createAttempt(studentId, conceptId, false, 'not_sure', 'medium', 5000);
    const resultNotSure = processAttemptInternal(baseState, eventNotSure, graph);
    const masteryNotSure = resultNotSure.newStateMap.get(`${studentId}:${conceptId}`)!.p_mastery;

    const dropSure = 0.9 - masterySure;
    const dropNotSure = 0.9 - masteryNotSure;
    expect(dropSure).toBeGreaterThan(dropNotSure);
  });

  // Test 4: 2 consecutive wrong answers fires loop flag
  it('2 consecutive wrong answers fires loop flag', () => {
    const conceptId = 'charge';
    let state: StudentStateMap = new Map();
    const eventWrong1 = createAttempt(studentId, conceptId, false, 'sure', 'easy', 5000);
    const result1 = processAttemptInternal(state, eventWrong1, graph);
    state = result1.newStateMap;
    expect(result1.loopFlag).toBe(false);

    const eventWrong2 = createAttempt(studentId, conceptId, false, 'sure', 'easy', 5000);
    const result2 = processAttemptInternal(state, eventWrong2, graph);
    state = result2.newStateMap;
    expect(result2.loopFlag).toBe(true);
  });

  // Test 5: Correct answer resets wrong_streak to 0
  it('Correct answer resets wrong_streak', () => {
    const conceptId = 'current';
    let state: StudentStateMap = new Map();
    const wrong1 = createAttempt(studentId, conceptId, false, 'not_sure', 'easy', 5000);
    const r1 = processAttemptInternal(state, wrong1, graph);
    state = r1.newStateMap;
    expect(state.get(`${studentId}:${conceptId}`)!.wrong_streak).toBe(1);

    const wrong2 = createAttempt(studentId, conceptId, false, 'not_sure', 'easy', 5000);
    const r2 = processAttemptInternal(state, wrong2, graph);
    state = r2.newStateMap;
    expect(state.get(`${studentId}:${conceptId}`)!.wrong_streak).toBe(2);

    const correct = createAttempt(studentId, conceptId, true, 'sure', 'medium', 5000);
    const r3 = processAttemptInternal(state, correct, graph);
    state = r3.newStateMap;
    expect(state.get(`${studentId}:${conceptId}`)!.wrong_streak).toBe(0);
  });

  // Test 6: Root-gap utility surfaces prerequisite with lowest mastery
  it('Root-gap surfaces prerequisite with lowest mastery', () => {
    const conceptId = 'series';
    const studentId2 = 'student2';
    const manualState: StudentStateMap = new Map<string, ConceptState>();
    const lowState: ConceptState = {
      p_mastery: 0.1,
      attempts: 1,
      wrong_streak: 0,
      clean_streak: 0,
      sure_wrong_count: 0,
      last_seen: Date.now(),
      status: 'weak',
    };
    const highState: ConceptState = {
      p_mastery: 0.9,
      attempts: 10,
      wrong_streak: 0,
      clean_streak: 3,
      sure_wrong_count: 0,
      last_seen: Date.now(),
      status: 'understood',
    };
    manualState.set(`${studentId2}:charge`, lowState);
    manualState.set(`${studentId2}:current`, { ...highState });
    manualState.set(`${studentId2}:voltage`, { ...highState });
    manualState.set(`${studentId2}:ohms_law`, { ...highState });
    manualState.set(`${studentId2}:resistance`, { ...highState });

    const event = createAttempt(studentId2, 'series', true, 'sure', 'medium', 5000);
    const result = processAttemptInternal(manualState, event, graph);
    expect(result.rootGap).toBe('charge');
  });

  // Cycle detection
  it('validateGraph throws on cyclic graph', () => {
    const cyclicGraph: ConceptGraphItem[] = [
      { id: 'a', name: 'A', prerequisites: ['b'] },
      { id: 'b', name: 'B', prerequisites: ['a'] },
    ];
    expect(() => validateGraph(cyclicGraph)).toThrow(CycleError);
  });

  // suggestDifficulty stepping
  it('suggestDifficulty steps up and down correctly', () => {
    const baseState: ConceptState = {
      p_mastery: 0.5,
      attempts: 1,
      wrong_streak: 0,
      clean_streak: 2,
      sure_wrong_count: 0,
      last_seen: 0,
      status: 'shaky',
    };
    expect(suggestDifficulty(baseState, 'easy')).toBe('medium');
    expect(suggestDifficulty(baseState, 'medium')).toBe('hard');
    expect(suggestDifficulty(baseState, 'hard')).toBe('hard');

    const wrongState: ConceptState = { ...baseState, clean_streak: 0, wrong_streak: 1 };
    expect(suggestDifficulty(wrongState, 'hard')).toBe('medium');
    expect(suggestDifficulty(wrongState, 'medium')).toBe('easy');
    expect(suggestDifficulty(wrongState, 'easy')).toBe('easy');
  });

  // getReport early estimate
  it('getReport flags early estimate when total questions < 10', () => {
    const emptyMap: StudentStateMap = new Map<string, ConceptState>();
    const reportEarly = getReport(emptyMap, graph, 5);
    expect(reportEarly.earlyEstimate).toBe(true);

    const reportLate = getReport(emptyMap, graph, 12);
    expect(reportLate.earlyEstimate).toBe(false);
  });
});