import React, { useState, useMemo } from 'react';

// ============================================================================
// TypeScript Interfaces & Types
// ============================================================================

export type ConceptStatus = 'understood' | 'shaky' | 'weak' | 'unseen';

export interface ConceptMasteryItem {
  conceptId: string;
  conceptName: string;
  prerequisites: string[];
  p_mastery: number; // 0.0 - 1.0
  status: ConceptStatus;
  attempts: number;
  wrong_streak: number;
  clean_streak: number;
  sure_wrong_count: number;
}

export interface StrugglePoint {
  id: string;
  conceptId: string;
  conceptName: string;
  rootGapConcept: string | null;
  rootGapName: string | null;
  reason: string; // Aggregated from "Why?" survey responses
  timestamp: string;
  timeSpentSeconds: number;
  loopBreakerTriggered: boolean;
  questionPrompt?: string;
}

export interface SimulatedStudent {
  id: string;
  name: string;
  avatarBg: string;
  overallScore: number; // 0 - 100 percentage
  completionDate: string;
  totalAttempts: number;
  conceptStates: ConceptMasteryItem[];
  struggle_points: StrugglePoint[];
  isStuckInLoop: boolean; // Flag for students heavily stuck in loop triggers
  hasPrerequisiteGap: boolean; // Flag for students failing foundational prerequisite concepts
  notes?: string;
}

export interface ClassGapInsight {
  conceptId: string;
  conceptName: string;
  prerequisites: string[];
  weakCount: number;
  shakyCount: number;
  understoodCount: number;
  totalCount: number;
  weakPercentage: number;
  severity: 'critical' | 'high' | 'moderate';
  rootPrereqGap: string | null;
  aggregatedReasons: { reason: string; count: number }[];
  affectedStudentIds: string[];
}

// ============================================================================
// Curated Chapter Concept Definitions (Electricity Chapter)
// ============================================================================

const CHAPTER_CONCEPTS = [
  { id: 'electric_charge', name: 'Electric Charge', prerequisites: [] },
  { id: 'current', name: 'Electric Current', prerequisites: ['electric_charge'] },
  { id: 'voltage', name: 'Electric Voltage', prerequisites: ['electric_charge'] },
  { id: 'ohm_law', name: 'Ohm’s Law (V = IR)', prerequisites: ['current', 'voltage'] },
  { id: 'resistor', name: 'Resistance Basics', prerequisites: ['ohm_law'] },
  { id: 'resistor_series', name: 'Resistors in Series', prerequisites: ['resistor'] },
  { id: 'resistor_parallel', name: 'Resistors in Parallel', prerequisites: ['resistor'] },
  { id: 'series_circuit', name: 'Series Circuit Analysis', prerequisites: ['resistor_series'] },
  { id: 'parallel_circuit', name: 'Parallel Circuit Analysis', prerequisites: ['resistor_parallel'] },
  { id: 'kirchoff_current', name: 'Kirchhoff’s Current Law (KCL)', prerequisites: ['series_circuit', 'parallel_circuit'] },
  { id: 'kirchoff_voltage', name: 'Kirchhoff’s Voltage Law (KVL)', prerequisites: ['series_circuit', 'parallel_circuit'] },
  { id: 'power', name: 'Electrical Power (P = VI)', prerequisites: ['voltage', 'current', 'ohm_law'] },
  { id: 'energy', name: 'Electrical Energy & Consumption', prerequisites: ['power'] },
  { id: 'capacitance', name: 'Capacitance & Charge Storage', prerequisites: ['voltage'] },
];

// ============================================================================
// 1. SEED DATA: 18 Simulated Students with Realistic Distribution
// - 4 Top Performers (high score, mostly understood, 0 loop triggers)
// - 11 Average / "Shaky" Students (55-79% score, 1-2 loop triggers)
// - 3 Heavily Stuck in Loop Triggers (<40% score, 5-8 loop triggers, root prerequisite failures)
// ============================================================================

export const MOCK_SIMULATED_STUDENTS: SimulatedStudent[] = [
  // ----------------- TOP PERFORMERS (3-4) -----------------
  {
    id: 'stu_01',
    name: 'Priya Sharma',
    avatarBg: 'bg-emerald-600',
    overallScore: 94,
    completionDate: '2026-10-31 14:22',
    totalAttempts: 24,
    isStuckInLoop: false,
    hasPrerequisiteGap: false,
    conceptStates: [
      { conceptId: 'electric_charge', conceptName: 'Electric Charge', prerequisites: [], p_mastery: 0.98, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 4, sure_wrong_count: 0 },
      { conceptId: 'current', conceptName: 'Electric Current', prerequisites: ['electric_charge'], p_mastery: 0.96, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 3, sure_wrong_count: 0 },
      { conceptId: 'voltage', conceptName: 'Electric Voltage', prerequisites: ['electric_charge'], p_mastery: 0.95, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 3, sure_wrong_count: 0 },
      { conceptId: 'ohm_law', conceptName: 'Ohm’s Law', prerequisites: ['current', 'voltage'], p_mastery: 0.94, status: 'understood', attempts: 3, wrong_streak: 0, clean_streak: 3, sure_wrong_count: 0 },
      { conceptId: 'resistor_series', conceptName: 'Resistors in Series', prerequisites: ['resistor'], p_mastery: 0.92, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 3, sure_wrong_count: 0 },
      { conceptId: 'resistor_parallel', conceptName: 'Resistors in Parallel', prerequisites: ['resistor'], p_mastery: 0.88, status: 'understood', attempts: 3, wrong_streak: 0, clean_streak: 3, sure_wrong_count: 0 },
      { conceptId: 'series_circuit', conceptName: 'Series Circuit Analysis', prerequisites: ['resistor_series'], p_mastery: 0.91, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 3, sure_wrong_count: 0 },
      { conceptId: 'parallel_circuit', conceptName: 'Parallel Circuit Analysis', prerequisites: ['resistor_parallel'], p_mastery: 0.89, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 3, sure_wrong_count: 0 },
      { conceptId: 'kirchoff_current', conceptName: 'Kirchhoff’s Current Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.86, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
      { conceptId: 'kirchoff_voltage', conceptName: 'Kirchhoff’s Voltage Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.84, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
      { conceptId: 'power', conceptName: 'Electrical Power', prerequisites: ['voltage', 'current', 'ohm_law'], p_mastery: 0.90, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 3, sure_wrong_count: 0 },
    ],
    struggle_points: [],
  },
  {
    id: 'stu_02',
    name: 'David Chen',
    avatarBg: 'bg-teal-600',
    overallScore: 91,
    completionDate: '2026-10-31 15:05',
    totalAttempts: 25,
    isStuckInLoop: false,
    hasPrerequisiteGap: false,
    conceptStates: [
      { conceptId: 'electric_charge', conceptName: 'Electric Charge', prerequisites: [], p_mastery: 0.96, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 3, sure_wrong_count: 0 },
      { conceptId: 'current', conceptName: 'Electric Current', prerequisites: ['electric_charge'], p_mastery: 0.94, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 3, sure_wrong_count: 0 },
      { conceptId: 'voltage', conceptName: 'Electric Voltage', prerequisites: ['electric_charge'], p_mastery: 0.92, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 3, sure_wrong_count: 0 },
      { conceptId: 'ohm_law', conceptName: 'Ohm’s Law', prerequisites: ['current', 'voltage'], p_mastery: 0.91, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 3, sure_wrong_count: 0 },
      { conceptId: 'resistor_series', conceptName: 'Resistors in Series', prerequisites: ['resistor'], p_mastery: 0.89, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 3, sure_wrong_count: 0 },
      { conceptId: 'resistor_parallel', conceptName: 'Resistors in Parallel', prerequisites: ['resistor'], p_mastery: 0.82, status: 'understood', attempts: 3, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
      { conceptId: 'series_circuit', conceptName: 'Series Circuit Analysis', prerequisites: ['resistor_series'], p_mastery: 0.88, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 3, sure_wrong_count: 0 },
      { conceptId: 'parallel_circuit', conceptName: 'Parallel Circuit Analysis', prerequisites: ['resistor_parallel'], p_mastery: 0.85, status: 'understood', attempts: 3, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
      { conceptId: 'kirchoff_current', conceptName: 'Kirchhoff’s Current Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.81, status: 'understood', attempts: 3, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
      { conceptId: 'kirchoff_voltage', conceptName: 'Kirchhoff’s Voltage Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.72, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'power', conceptName: 'Electrical Power', prerequisites: ['voltage', 'current', 'ohm_law'], p_mastery: 0.87, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
    ],
    struggle_points: [
      {
        id: 'sp_d1',
        conceptId: 'kirchoff_voltage',
        conceptName: 'Kirchhoff’s Voltage Law',
        rootGapConcept: null,
        rootGapName: null,
        reason: 'Calculation error on multi-source loop',
        timestamp: '15:18',
        timeSpentSeconds: 42,
        loopBreakerTriggered: false,
      },
    ],
  },
  {
    id: 'stu_03',
    name: 'Liam O’Connor',
    avatarBg: 'bg-cyan-600',
    overallScore: 89,
    completionDate: '2026-10-31 13:40',
    totalAttempts: 23,
    isStuckInLoop: false,
    hasPrerequisiteGap: false,
    conceptStates: [
      { conceptId: 'electric_charge', conceptName: 'Electric Charge', prerequisites: [], p_mastery: 0.95, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 3, sure_wrong_count: 0 },
      { conceptId: 'current', conceptName: 'Electric Current', prerequisites: ['electric_charge'], p_mastery: 0.92, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 3, sure_wrong_count: 0 },
      { conceptId: 'voltage', conceptName: 'Electric Voltage', prerequisites: ['electric_charge'], p_mastery: 0.91, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 3, sure_wrong_count: 0 },
      { conceptId: 'ohm_law', conceptName: 'Ohm’s Law', prerequisites: ['current', 'voltage'], p_mastery: 0.88, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 3, sure_wrong_count: 0 },
      { conceptId: 'resistor_series', conceptName: 'Resistors in Series', prerequisites: ['resistor'], p_mastery: 0.87, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 3, sure_wrong_count: 0 },
      { conceptId: 'resistor_parallel', conceptName: 'Resistors in Parallel', prerequisites: ['resistor'], p_mastery: 0.81, status: 'understood', attempts: 3, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
      { conceptId: 'series_circuit', conceptName: 'Series Circuit Analysis', prerequisites: ['resistor_series'], p_mastery: 0.86, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
      { conceptId: 'parallel_circuit', conceptName: 'Parallel Circuit Analysis', prerequisites: ['resistor_parallel'], p_mastery: 0.77, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'kirchoff_current', conceptName: 'Kirchhoff’s Current Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.82, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
      { conceptId: 'kirchoff_voltage', conceptName: 'Kirchhoff’s Voltage Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.76, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'power', conceptName: 'Electrical Power', prerequisites: ['voltage', 'current', 'ohm_law'], p_mastery: 0.85, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
    ],
    struggle_points: [],
  },
  {
    id: 'stu_04',
    name: 'Ananya Iyer',
    avatarBg: 'bg-emerald-700',
    overallScore: 88,
    completionDate: '2026-10-31 16:10',
    totalAttempts: 26,
    isStuckInLoop: false,
    hasPrerequisiteGap: false,
    conceptStates: [
      { conceptId: 'electric_charge', conceptName: 'Electric Charge', prerequisites: [], p_mastery: 0.94, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 3, sure_wrong_count: 0 },
      { conceptId: 'current', conceptName: 'Electric Current', prerequisites: ['electric_charge'], p_mastery: 0.93, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 3, sure_wrong_count: 0 },
      { conceptId: 'voltage', conceptName: 'Electric Voltage', prerequisites: ['electric_charge'], p_mastery: 0.90, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 3, sure_wrong_count: 0 },
      { conceptId: 'ohm_law', conceptName: 'Ohm’s Law', prerequisites: ['current', 'voltage'], p_mastery: 0.87, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 3, sure_wrong_count: 0 },
      { conceptId: 'resistor_series', conceptName: 'Resistors in Series', prerequisites: ['resistor'], p_mastery: 0.85, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
      { conceptId: 'resistor_parallel', conceptName: 'Resistors in Parallel', prerequisites: ['resistor'], p_mastery: 0.74, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'series_circuit', conceptName: 'Series Circuit Analysis', prerequisites: ['resistor_series'], p_mastery: 0.88, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
      { conceptId: 'parallel_circuit', conceptName: 'Parallel Circuit Analysis', prerequisites: ['resistor_parallel'], p_mastery: 0.73, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'kirchoff_current', conceptName: 'Kirchhoff’s Current Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.84, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
      { conceptId: 'kirchoff_voltage', conceptName: 'Kirchhoff’s Voltage Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.78, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'power', conceptName: 'Electrical Power', prerequisites: ['voltage', 'current', 'ohm_law'], p_mastery: 0.86, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
    ],
    struggle_points: [
      {
        id: 'sp_a1',
        conceptId: 'resistor_parallel',
        conceptName: 'Resistors in Parallel',
        rootGapConcept: null,
        rootGapName: null,
        reason: 'Calculation error on reciprocal formula (1/R_total)',
        timestamp: '16:24',
        timeSpentSeconds: 38,
        loopBreakerTriggered: false,
      },
    ],
  },

  // ----------------- AVERAGE / SHAKY CLUSTER (11) -----------------
  {
    id: 'stu_05',
    name: 'Marcus Vance',
    avatarBg: 'bg-blue-600',
    overallScore: 78,
    completionDate: '2026-10-31 11:15',
    totalAttempts: 27,
    isStuckInLoop: false,
    hasPrerequisiteGap: false,
    conceptStates: [
      { conceptId: 'electric_charge', conceptName: 'Electric Charge', prerequisites: [], p_mastery: 0.90, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 3, sure_wrong_count: 0 },
      { conceptId: 'current', conceptName: 'Electric Current', prerequisites: ['electric_charge'], p_mastery: 0.88, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 3, sure_wrong_count: 0 },
      { conceptId: 'voltage', conceptName: 'Electric Voltage', prerequisites: ['electric_charge'], p_mastery: 0.82, status: 'understood', attempts: 3, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
      { conceptId: 'ohm_law', conceptName: 'Ohm’s Law', prerequisites: ['current', 'voltage'], p_mastery: 0.80, status: 'understood', attempts: 3, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
      { conceptId: 'resistor_series', conceptName: 'Resistors in Series', prerequisites: ['resistor'], p_mastery: 0.81, status: 'understood', attempts: 3, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
      { conceptId: 'resistor_parallel', conceptName: 'Resistors in Parallel', prerequisites: ['resistor'], p_mastery: 0.38, status: 'weak', attempts: 4, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'series_circuit', conceptName: 'Series Circuit Analysis', prerequisites: ['resistor_series'], p_mastery: 0.74, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'parallel_circuit', conceptName: 'Parallel Circuit Analysis', prerequisites: ['resistor_parallel'], p_mastery: 0.45, status: 'shaky', attempts: 4, wrong_streak: 1, clean_streak: 0, sure_wrong_count: 0 },
      { conceptId: 'kirchoff_current', conceptName: 'Kirchhoff’s Current Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.70, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'kirchoff_voltage', conceptName: 'Kirchhoff’s Voltage Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.35, status: 'weak', attempts: 4, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'power', conceptName: 'Electrical Power', prerequisites: ['voltage', 'current', 'ohm_law'], p_mastery: 0.80, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
    ],
    struggle_points: [
      {
        id: 'sp_mv1',
        conceptId: 'resistor_parallel',
        conceptName: 'Resistors in Parallel',
        rootGapConcept: 'resistor',
        rootGapName: 'Resistance Basics',
        reason: 'Confusing series and parallel voltage rules',
        timestamp: '11:28',
        timeSpentSeconds: 58,
        loopBreakerTriggered: true,
      },
    ],
  },
  {
    id: 'stu_06',
    name: 'Maya Patel',
    avatarBg: 'bg-indigo-600',
    overallScore: 75,
    completionDate: '2026-10-31 12:45',
    totalAttempts: 29,
    isStuckInLoop: false,
    hasPrerequisiteGap: false,
    conceptStates: [
      { conceptId: 'electric_charge', conceptName: 'Electric Charge', prerequisites: [], p_mastery: 0.89, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
      { conceptId: 'current', conceptName: 'Electric Current', prerequisites: ['electric_charge'], p_mastery: 0.85, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
      { conceptId: 'voltage', conceptName: 'Electric Voltage', prerequisites: ['electric_charge'], p_mastery: 0.80, status: 'understood', attempts: 3, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
      { conceptId: 'ohm_law', conceptName: 'Ohm’s Law', prerequisites: ['current', 'voltage'], p_mastery: 0.77, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'resistor_series', conceptName: 'Resistors in Series', prerequisites: ['resistor'], p_mastery: 0.79, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'resistor_parallel', conceptName: 'Resistors in Parallel', prerequisites: ['resistor'], p_mastery: 0.36, status: 'weak', attempts: 5, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'series_circuit', conceptName: 'Series Circuit Analysis', prerequisites: ['resistor_series'], p_mastery: 0.72, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'parallel_circuit', conceptName: 'Parallel Circuit Analysis', prerequisites: ['resistor_parallel'], p_mastery: 0.48, status: 'shaky', attempts: 4, wrong_streak: 1, clean_streak: 0, sure_wrong_count: 0 },
      { conceptId: 'kirchoff_current', conceptName: 'Kirchhoff’s Current Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.74, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'kirchoff_voltage', conceptName: 'Kirchhoff’s Voltage Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.34, status: 'weak', attempts: 4, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'power', conceptName: 'Electrical Power', prerequisites: ['voltage', 'current', 'ohm_law'], p_mastery: 0.81, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
    ],
    struggle_points: [
      {
        id: 'sp_mp1',
        conceptId: 'resistor_parallel',
        conceptName: 'Resistors in Parallel',
        rootGapConcept: 'resistor',
        rootGapName: 'Resistance Basics',
        reason: 'Calculation error on reciprocal formula (1/R_total)',
        timestamp: '13:02',
        timeSpentSeconds: 64,
        loopBreakerTriggered: true,
      },
    ],
  },
  {
    id: 'stu_07',
    name: 'Jordan Taylor',
    avatarBg: 'bg-violet-600',
    overallScore: 72,
    completionDate: '2026-10-31 10:30',
    totalAttempts: 31,
    isStuckInLoop: false,
    hasPrerequisiteGap: false,
    conceptStates: [
      { conceptId: 'electric_charge', conceptName: 'Electric Charge', prerequisites: [], p_mastery: 0.88, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
      { conceptId: 'current', conceptName: 'Electric Current', prerequisites: ['electric_charge'], p_mastery: 0.82, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
      { conceptId: 'voltage', conceptName: 'Electric Voltage', prerequisites: ['electric_charge'], p_mastery: 0.80, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
      { conceptId: 'ohm_law', conceptName: 'Ohm’s Law', prerequisites: ['current', 'voltage'], p_mastery: 0.72, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'resistor_series', conceptName: 'Resistors in Series', prerequisites: ['resistor'], p_mastery: 0.71, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'resistor_parallel', conceptName: 'Resistors in Parallel', prerequisites: ['resistor'], p_mastery: 0.35, status: 'weak', attempts: 5, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'series_circuit', conceptName: 'Series Circuit Analysis', prerequisites: ['resistor_series'], p_mastery: 0.68, status: 'shaky', attempts: 4, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'parallel_circuit', conceptName: 'Parallel Circuit Analysis', prerequisites: ['resistor_parallel'], p_mastery: 0.50, status: 'shaky', attempts: 4, wrong_streak: 1, clean_streak: 0, sure_wrong_count: 0 },
      { conceptId: 'kirchoff_current', conceptName: 'Kirchhoff’s Current Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.65, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'kirchoff_voltage', conceptName: 'Kirchhoff’s Voltage Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.32, status: 'weak', attempts: 5, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 2 },
      { conceptId: 'power', conceptName: 'Electrical Power', prerequisites: ['voltage', 'current', 'ohm_law'], p_mastery: 0.79, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
    ],
    struggle_points: [
      {
        id: 'sp_jt1',
        conceptId: 'resistor_parallel',
        conceptName: 'Resistors in Parallel',
        rootGapConcept: 'resistor',
        rootGapName: 'Resistance Basics',
        reason: 'Confusing series and parallel voltage rules',
        timestamp: '10:48',
        timeSpentSeconds: 71,
        loopBreakerTriggered: true,
      },
      {
        id: 'sp_jt2',
        conceptId: 'kirchoff_voltage',
        conceptName: 'Kirchhoff’s Voltage Law',
        rootGapConcept: 'voltage',
        rootGapName: 'Electric Voltage',
        reason: 'Confused node voltage with branch potential drop',
        timestamp: '11:02',
        timeSpentSeconds: 65,
        loopBreakerTriggered: true,
      },
    ],
  },
  {
    id: 'stu_08',
    name: 'Sophia Rodriguez',
    avatarBg: 'bg-purple-600',
    overallScore: 69,
    completionDate: '2026-10-31 09:50',
    totalAttempts: 32,
    isStuckInLoop: false,
    hasPrerequisiteGap: false,
    conceptStates: [
      { conceptId: 'electric_charge', conceptName: 'Electric Charge', prerequisites: [], p_mastery: 0.86, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
      { conceptId: 'current', conceptName: 'Electric Current', prerequisites: ['electric_charge'], p_mastery: 0.80, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
      { conceptId: 'voltage', conceptName: 'Electric Voltage', prerequisites: ['electric_charge'], p_mastery: 0.76, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'ohm_law', conceptName: 'Ohm’s Law', prerequisites: ['current', 'voltage'], p_mastery: 0.70, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'resistor_series', conceptName: 'Resistors in Series', prerequisites: ['resistor'], p_mastery: 0.65, status: 'shaky', attempts: 4, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'resistor_parallel', conceptName: 'Resistors in Parallel', prerequisites: ['resistor'], p_mastery: 0.32, status: 'weak', attempts: 5, wrong_streak: 3, clean_streak: 0, sure_wrong_count: 2 },
      { conceptId: 'series_circuit', conceptName: 'Series Circuit Analysis', prerequisites: ['resistor_series'], p_mastery: 0.38, status: 'weak', attempts: 4, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'parallel_circuit', conceptName: 'Parallel Circuit Analysis', prerequisites: ['resistor_parallel'], p_mastery: 0.44, status: 'shaky', attempts: 4, wrong_streak: 1, clean_streak: 0, sure_wrong_count: 0 },
      { conceptId: 'kirchoff_current', conceptName: 'Kirchhoff’s Current Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.62, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'kirchoff_voltage', conceptName: 'Kirchhoff’s Voltage Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.30, status: 'weak', attempts: 5, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'power', conceptName: 'Electrical Power', prerequisites: ['voltage', 'current', 'ohm_law'], p_mastery: 0.72, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
    ],
    struggle_points: [
      {
        id: 'sp_sr1',
        conceptId: 'resistor_parallel',
        conceptName: 'Resistors in Parallel',
        rootGapConcept: 'resistor',
        rootGapName: 'Resistance Basics',
        reason: 'Confusing series and parallel voltage rules',
        timestamp: '10:12',
        timeSpentSeconds: 82,
        loopBreakerTriggered: true,
      },
      {
        id: 'sp_sr2',
        conceptId: 'kirchoff_voltage',
        conceptName: 'Kirchhoff’s Voltage Law',
        rootGapConcept: 'series_circuit',
        rootGapName: 'Series Circuit Analysis',
        reason: 'Misapplied Kirchhoff loop rule sign conventions',
        timestamp: '10:28',
        timeSpentSeconds: 61,
        loopBreakerTriggered: true,
      },
    ],
  },
  {
    id: 'stu_09',
    name: 'Ethan Wright',
    avatarBg: 'bg-pink-600',
    overallScore: 67,
    completionDate: '2026-10-31 16:30',
    totalAttempts: 30,
    isStuckInLoop: false,
    hasPrerequisiteGap: false,
    conceptStates: [
      { conceptId: 'electric_charge', conceptName: 'Electric Charge', prerequisites: [], p_mastery: 0.85, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
      { conceptId: 'current', conceptName: 'Electric Current', prerequisites: ['electric_charge'], p_mastery: 0.82, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
      { conceptId: 'voltage', conceptName: 'Electric Voltage', prerequisites: ['electric_charge'], p_mastery: 0.75, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'ohm_law', conceptName: 'Ohm’s Law', prerequisites: ['current', 'voltage'], p_mastery: 0.74, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'resistor_series', conceptName: 'Resistors in Series', prerequisites: ['resistor'], p_mastery: 0.69, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'resistor_parallel', conceptName: 'Resistors in Parallel', prerequisites: ['resistor'], p_mastery: 0.33, status: 'weak', attempts: 4, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'series_circuit', conceptName: 'Series Circuit Analysis', prerequisites: ['resistor_series'], p_mastery: 0.36, status: 'weak', attempts: 4, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'parallel_circuit', conceptName: 'Parallel Circuit Analysis', prerequisites: ['resistor_parallel'], p_mastery: 0.49, status: 'shaky', attempts: 4, wrong_streak: 1, clean_streak: 0, sure_wrong_count: 0 },
      { conceptId: 'kirchoff_current', conceptName: 'Kirchhoff’s Current Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.64, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'kirchoff_voltage', conceptName: 'Kirchhoff’s Voltage Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.31, status: 'weak', attempts: 5, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'power', conceptName: 'Electrical Power', prerequisites: ['voltage', 'current', 'ohm_law'], p_mastery: 0.70, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
    ],
    struggle_points: [
      {
        id: 'sp_ew1',
        conceptId: 'kirchoff_voltage',
        conceptName: 'Kirchhoff’s Voltage Law',
        rootGapConcept: 'voltage',
        rootGapName: 'Electric Voltage',
        reason: 'Misapplied Kirchhoff loop rule sign conventions',
        timestamp: '16:48',
        timeSpentSeconds: 79,
        loopBreakerTriggered: true,
      },
    ],
  },
  {
    id: 'stu_10',
    name: 'Fatima Al-Mansoor',
    avatarBg: 'bg-rose-600',
    overallScore: 66,
    completionDate: '2026-10-31 14:00',
    totalAttempts: 33,
    isStuckInLoop: false,
    hasPrerequisiteGap: false,
    conceptStates: [
      { conceptId: 'electric_charge', conceptName: 'Electric Charge', prerequisites: [], p_mastery: 0.84, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
      { conceptId: 'current', conceptName: 'Electric Current', prerequisites: ['electric_charge'], p_mastery: 0.81, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
      { conceptId: 'voltage', conceptName: 'Electric Voltage', prerequisites: ['electric_charge'], p_mastery: 0.72, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'ohm_law', conceptName: 'Ohm’s Law', prerequisites: ['current', 'voltage'], p_mastery: 0.68, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'resistor_series', conceptName: 'Resistors in Series', prerequisites: ['resistor'], p_mastery: 0.65, status: 'shaky', attempts: 4, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'resistor_parallel', conceptName: 'Resistors in Parallel', prerequisites: ['resistor'], p_mastery: 0.29, status: 'weak', attempts: 5, wrong_streak: 3, clean_streak: 0, sure_wrong_count: 2 },
      { conceptId: 'series_circuit', conceptName: 'Series Circuit Analysis', prerequisites: ['resistor_series'], p_mastery: 0.34, status: 'weak', attempts: 4, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'parallel_circuit', conceptName: 'Parallel Circuit Analysis', prerequisites: ['resistor_parallel'], p_mastery: 0.47, status: 'shaky', attempts: 4, wrong_streak: 1, clean_streak: 0, sure_wrong_count: 0 },
      { conceptId: 'kirchoff_current', conceptName: 'Kirchhoff’s Current Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.38, status: 'weak', attempts: 4, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'kirchoff_voltage', conceptName: 'Kirchhoff’s Voltage Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.30, status: 'weak', attempts: 5, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'power', conceptName: 'Electrical Power', prerequisites: ['voltage', 'current', 'ohm_law'], p_mastery: 0.71, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
    ],
    struggle_points: [
      {
        id: 'sp_fa1',
        conceptId: 'resistor_parallel',
        conceptName: 'Resistors in Parallel',
        rootGapConcept: 'resistor',
        rootGapName: 'Resistance Basics',
        reason: 'Treating parallel resistors as simple addition instead of reciprocal',
        timestamp: '14:18',
        timeSpentSeconds: 67,
        loopBreakerTriggered: true,
      },
      {
        id: 'sp_fa2',
        conceptId: 'kirchoff_current',
        conceptName: 'Kirchhoff’s Current Law',
        rootGapConcept: 'current',
        rootGapName: 'Electric Current',
        reason: 'Forgot that junction current in equals junction current out',
        timestamp: '14:35',
        timeSpentSeconds: 52,
        loopBreakerTriggered: true,
      },
    ],
  },
  {
    id: 'stu_11',
    name: 'Lucas Silva',
    avatarBg: 'bg-amber-600',
    overallScore: 64,
    completionDate: '2026-10-31 08:45',
    totalAttempts: 34,
    isStuckInLoop: false,
    hasPrerequisiteGap: false,
    conceptStates: [
      { conceptId: 'electric_charge', conceptName: 'Electric Charge', prerequisites: [], p_mastery: 0.83, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
      { conceptId: 'current', conceptName: 'Electric Current', prerequisites: ['electric_charge'], p_mastery: 0.78, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'voltage', conceptName: 'Electric Voltage', prerequisites: ['electric_charge'], p_mastery: 0.71, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'ohm_law', conceptName: 'Ohm’s Law', prerequisites: ['current', 'voltage'], p_mastery: 0.67, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'resistor_series', conceptName: 'Resistors in Series', prerequisites: ['resistor'], p_mastery: 0.63, status: 'shaky', attempts: 4, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'resistor_parallel', conceptName: 'Resistors in Parallel', prerequisites: ['resistor'], p_mastery: 0.28, status: 'weak', attempts: 5, wrong_streak: 3, clean_streak: 0, sure_wrong_count: 2 },
      { conceptId: 'series_circuit', conceptName: 'Series Circuit Analysis', prerequisites: ['resistor_series'], p_mastery: 0.35, status: 'weak', attempts: 4, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'parallel_circuit', conceptName: 'Parallel Circuit Analysis', prerequisites: ['resistor_parallel'], p_mastery: 0.44, status: 'shaky', attempts: 4, wrong_streak: 1, clean_streak: 0, sure_wrong_count: 0 },
      { conceptId: 'kirchoff_current', conceptName: 'Kirchhoff’s Current Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.37, status: 'weak', attempts: 5, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'kirchoff_voltage', conceptName: 'Kirchhoff’s Voltage Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.29, status: 'weak', attempts: 5, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'power', conceptName: 'Electrical Power', prerequisites: ['voltage', 'current', 'ohm_law'], p_mastery: 0.69, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
    ],
    struggle_points: [
      {
        id: 'sp_ls1',
        conceptId: 'resistor_parallel',
        conceptName: 'Resistors in Parallel',
        rootGapConcept: 'resistor',
        rootGapName: 'Resistance Basics',
        reason: 'Confusing series and parallel voltage rules',
        timestamp: '09:02',
        timeSpentSeconds: 88,
        loopBreakerTriggered: true,
      },
      {
        id: 'sp_ls2',
        conceptId: 'kirchoff_current',
        conceptName: 'Kirchhoff’s Current Law',
        rootGapConcept: 'current',
        rootGapName: 'Electric Current',
        reason: 'Forgot that junction current in equals junction current out',
        timestamp: '09:22',
        timeSpentSeconds: 61,
        loopBreakerTriggered: true,
      },
    ],
  },
  {
    id: 'stu_12',
    name: 'Chloe Bennett',
    avatarBg: 'bg-emerald-800',
    overallScore: 62,
    completionDate: '2026-10-31 15:50',
    totalAttempts: 32,
    isStuckInLoop: false,
    hasPrerequisiteGap: false,
    conceptStates: [
      { conceptId: 'electric_charge', conceptName: 'Electric Charge', prerequisites: [], p_mastery: 0.81, status: 'understood', attempts: 2, wrong_streak: 0, clean_streak: 2, sure_wrong_count: 0 },
      { conceptId: 'current', conceptName: 'Electric Current', prerequisites: ['electric_charge'], p_mastery: 0.77, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'voltage', conceptName: 'Electric Voltage', prerequisites: ['electric_charge'], p_mastery: 0.70, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'ohm_law', conceptName: 'Ohm’s Law', prerequisites: ['current', 'voltage'], p_mastery: 0.65, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'resistor_series', conceptName: 'Resistors in Series', prerequisites: ['resistor'], p_mastery: 0.62, status: 'shaky', attempts: 4, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'resistor_parallel', conceptName: 'Resistors in Parallel', prerequisites: ['resistor'], p_mastery: 0.27, status: 'weak', attempts: 5, wrong_streak: 3, clean_streak: 0, sure_wrong_count: 2 },
      { conceptId: 'series_circuit', conceptName: 'Series Circuit Analysis', prerequisites: ['resistor_series'], p_mastery: 0.33, status: 'weak', attempts: 4, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'parallel_circuit', conceptName: 'Parallel Circuit Analysis', prerequisites: ['resistor_parallel'], p_mastery: 0.42, status: 'shaky', attempts: 4, wrong_streak: 1, clean_streak: 0, sure_wrong_count: 0 },
      { conceptId: 'kirchoff_current', conceptName: 'Kirchhoff’s Current Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.36, status: 'weak', attempts: 4, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'kirchoff_voltage', conceptName: 'Kirchhoff’s Voltage Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.28, status: 'weak', attempts: 5, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'power', conceptName: 'Electrical Power', prerequisites: ['voltage', 'current', 'ohm_law'], p_mastery: 0.68, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
    ],
    struggle_points: [
      {
        id: 'sp_cb1',
        conceptId: 'resistor_parallel',
        conceptName: 'Resistors in Parallel',
        rootGapConcept: 'resistor',
        rootGapName: 'Resistance Basics',
        reason: 'Confusing series and parallel voltage rules',
        timestamp: '16:04',
        timeSpentSeconds: 74,
        loopBreakerTriggered: true,
      },
      {
        id: 'sp_cb2',
        conceptId: 'series_circuit',
        conceptName: 'Series Circuit Analysis',
        rootGapConcept: 'resistor_series',
        rootGapName: 'Resistors in Series',
        reason: 'Confused current conservation with voltage division',
        timestamp: '16:21',
        timeSpentSeconds: 58,
        loopBreakerTriggered: true,
      },
    ],
  },
  {
    id: 'stu_13',
    name: 'Noah Kim',
    avatarBg: 'bg-cyan-700',
    overallScore: 60,
    completionDate: '2026-10-31 12:10',
    totalAttempts: 35,
    isStuckInLoop: false,
    hasPrerequisiteGap: true, // Prerequisite gap: Ohm's law weak
    conceptStates: [
      { conceptId: 'electric_charge', conceptName: 'Electric Charge', prerequisites: [], p_mastery: 0.79, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'current', conceptName: 'Electric Current', prerequisites: ['electric_charge'], p_mastery: 0.72, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'voltage', conceptName: 'Electric Voltage', prerequisites: ['electric_charge'], p_mastery: 0.68, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'ohm_law', conceptName: 'Ohm’s Law', prerequisites: ['current', 'voltage'], p_mastery: 0.38, status: 'weak', attempts: 4, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'resistor_series', conceptName: 'Resistors in Series', prerequisites: ['resistor'], p_mastery: 0.60, status: 'shaky', attempts: 4, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'resistor_parallel', conceptName: 'Resistors in Parallel', prerequisites: ['resistor'], p_mastery: 0.25, status: 'weak', attempts: 5, wrong_streak: 3, clean_streak: 0, sure_wrong_count: 2 },
      { conceptId: 'series_circuit', conceptName: 'Series Circuit Analysis', prerequisites: ['resistor_series'], p_mastery: 0.32, status: 'weak', attempts: 4, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'parallel_circuit', conceptName: 'Parallel Circuit Analysis', prerequisites: ['resistor_parallel'], p_mastery: 0.40, status: 'shaky', attempts: 4, wrong_streak: 1, clean_streak: 0, sure_wrong_count: 0 },
      { conceptId: 'kirchoff_current', conceptName: 'Kirchhoff’s Current Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.35, status: 'weak', attempts: 5, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'kirchoff_voltage', conceptName: 'Kirchhoff’s Voltage Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.26, status: 'weak', attempts: 5, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'power', conceptName: 'Electrical Power', prerequisites: ['voltage', 'current', 'ohm_law'], p_mastery: 0.62, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
    ],
    struggle_points: [
      {
        id: 'sp_nk1',
        conceptId: 'ohm_law',
        conceptName: 'Ohm’s Law',
        rootGapConcept: 'voltage',
        rootGapName: 'Electric Voltage',
        reason: 'Confusing current units with voltage units',
        timestamp: '12:24',
        timeSpentSeconds: 69,
        loopBreakerTriggered: true,
      },
      {
        id: 'sp_nk2',
        conceptId: 'resistor_parallel',
        conceptName: 'Resistors in Parallel',
        rootGapConcept: 'ohm_law',
        rootGapName: 'Ohm’s Law',
        reason: 'Confusing series and parallel voltage rules',
        timestamp: '12:41',
        timeSpentSeconds: 83,
        loopBreakerTriggered: true,
      },
      {
        id: 'sp_nk3',
        conceptId: 'kirchoff_voltage',
        conceptName: 'Kirchhoff’s Voltage Law',
        rootGapConcept: 'voltage',
        rootGapName: 'Electric Voltage',
        reason: 'Misapplied Kirchhoff loop rule sign conventions',
        timestamp: '12:56',
        timeSpentSeconds: 76,
        loopBreakerTriggered: true,
      },
    ],
  },
  {
    id: 'stu_14',
    name: 'Zara Hassan',
    avatarBg: 'bg-teal-700',
    overallScore: 58,
    completionDate: '2026-10-31 17:15',
    totalAttempts: 34,
    isStuckInLoop: false,
    hasPrerequisiteGap: false,
    conceptStates: [
      { conceptId: 'electric_charge', conceptName: 'Electric Charge', prerequisites: [], p_mastery: 0.78, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'current', conceptName: 'Electric Current', prerequisites: ['electric_charge'], p_mastery: 0.71, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'voltage', conceptName: 'Electric Voltage', prerequisites: ['electric_charge'], p_mastery: 0.66, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'ohm_law', conceptName: 'Ohm’s Law', prerequisites: ['current', 'voltage'], p_mastery: 0.62, status: 'shaky', attempts: 4, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'resistor_series', conceptName: 'Resistors in Series', prerequisites: ['resistor'], p_mastery: 0.58, status: 'shaky', attempts: 4, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'resistor_parallel', conceptName: 'Resistors in Parallel', prerequisites: ['resistor'], p_mastery: 0.24, status: 'weak', attempts: 5, wrong_streak: 3, clean_streak: 0, sure_wrong_count: 2 },
      { conceptId: 'series_circuit', conceptName: 'Series Circuit Analysis', prerequisites: ['resistor_series'], p_mastery: 0.31, status: 'weak', attempts: 4, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'parallel_circuit', conceptName: 'Parallel Circuit Analysis', prerequisites: ['resistor_parallel'], p_mastery: 0.38, status: 'weak', attempts: 5, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'kirchoff_current', conceptName: 'Kirchhoff’s Current Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.33, status: 'weak', attempts: 5, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'kirchoff_voltage', conceptName: 'Kirchhoff’s Voltage Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.25, status: 'weak', attempts: 5, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'power', conceptName: 'Electrical Power', prerequisites: ['voltage', 'current', 'ohm_law'], p_mastery: 0.60, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
    ],
    struggle_points: [
      {
        id: 'sp_zh1',
        conceptId: 'resistor_parallel',
        conceptName: 'Resistors in Parallel',
        rootGapConcept: 'resistor',
        rootGapName: 'Resistance Basics',
        reason: 'Treating parallel resistors as simple addition instead of reciprocal',
        timestamp: '17:32',
        timeSpentSeconds: 79,
        loopBreakerTriggered: true,
      },
      {
        id: 'sp_zh2',
        conceptId: 'kirchoff_voltage',
        conceptName: 'Kirchhoff’s Voltage Law',
        rootGapConcept: 'series_circuit',
        rootGapName: 'Series Circuit Analysis',
        reason: 'Confused node voltage with branch potential drop',
        timestamp: '17:50',
        timeSpentSeconds: 84,
        loopBreakerTriggered: true,
      },
    ],
  },
  {
    id: 'stu_15',
    name: 'Benjamin Hayes',
    avatarBg: 'bg-stone-600',
    overallScore: 54,
    completionDate: '2026-10-31 10:00',
    totalAttempts: 36,
    isStuckInLoop: false,
    hasPrerequisiteGap: true, // Prerequisite gap: Ohm's law weak
    conceptStates: [
      { conceptId: 'electric_charge', conceptName: 'Electric Charge', prerequisites: [], p_mastery: 0.75, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'current', conceptName: 'Electric Current', prerequisites: ['electric_charge'], p_mastery: 0.68, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'voltage', conceptName: 'Electric Voltage', prerequisites: ['electric_charge'], p_mastery: 0.64, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'ohm_law', conceptName: 'Ohm’s Law', prerequisites: ['current', 'voltage'], p_mastery: 0.36, status: 'weak', attempts: 5, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'resistor_series', conceptName: 'Resistors in Series', prerequisites: ['resistor'], p_mastery: 0.55, status: 'shaky', attempts: 4, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'resistor_parallel', conceptName: 'Resistors in Parallel', prerequisites: ['resistor'], p_mastery: 0.22, status: 'weak', attempts: 5, wrong_streak: 3, clean_streak: 0, sure_wrong_count: 2 },
      { conceptId: 'series_circuit', conceptName: 'Series Circuit Analysis', prerequisites: ['resistor_series'], p_mastery: 0.28, status: 'weak', attempts: 5, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'parallel_circuit', conceptName: 'Parallel Circuit Analysis', prerequisites: ['resistor_parallel'], p_mastery: 0.35, status: 'weak', attempts: 5, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'kirchoff_current', conceptName: 'Kirchhoff’s Current Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.31, status: 'weak', attempts: 5, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'kirchoff_voltage', conceptName: 'Kirchhoff’s Voltage Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.22, status: 'weak', attempts: 6, wrong_streak: 3, clean_streak: 0, sure_wrong_count: 2 },
      { conceptId: 'power', conceptName: 'Electrical Power', prerequisites: ['voltage', 'current', 'ohm_law'], p_mastery: 0.58, status: 'shaky', attempts: 4, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
    ],
    struggle_points: [
      {
        id: 'sp_bh1',
        conceptId: 'resistor_parallel',
        conceptName: 'Resistors in Parallel',
        rootGapConcept: 'ohm_law',
        rootGapName: 'Ohm’s Law',
        reason: 'Confusing series and parallel voltage rules',
        timestamp: '10:22',
        timeSpentSeconds: 92,
        loopBreakerTriggered: true,
      },
      {
        id: 'sp_bh2',
        conceptId: 'kirchoff_voltage',
        conceptName: 'Kirchhoff’s Voltage Law',
        rootGapConcept: 'series_circuit',
        rootGapName: 'Series Circuit Analysis',
        reason: 'Misapplied Kirchhoff loop rule sign conventions',
        timestamp: '10:44',
        timeSpentSeconds: 85,
        loopBreakerTriggered: true,
      },
      {
        id: 'sp_bh3',
        conceptId: 'ohm_law',
        conceptName: 'Ohm’s Law',
        rootGapConcept: 'voltage',
        rootGapName: 'Electric Voltage',
        reason: 'Confused V = IR with P = VI power relationship',
        timestamp: '10:59',
        timeSpentSeconds: 70,
        loopBreakerTriggered: true,
      },
    ],
  },

  // ----------------- HEAVILY STUCK IN LOOP TRIGGERS (2-3) -----------------
  {
    id: 'stu_16',
    name: 'Tyler Brooks',
    avatarBg: 'bg-red-600',
    overallScore: 38,
    completionDate: '2026-10-31 09:15',
    totalAttempts: 41,
    isStuckInLoop: true, // HEAVILY STUCK
    hasPrerequisiteGap: true, // Prerequisite gap: Ohm's law & Current
    notes: 'Stuck in continuous loop breaker cycles on parallel resistance. Traced to root gap in Ohm’s Law & proportional voltage.',
    conceptStates: [
      { conceptId: 'electric_charge', conceptName: 'Electric Charge', prerequisites: [], p_mastery: 0.65, status: 'shaky', attempts: 3, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 0 },
      { conceptId: 'current', conceptName: 'Electric Current', prerequisites: ['electric_charge'], p_mastery: 0.42, status: 'shaky', attempts: 4, wrong_streak: 1, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'voltage', conceptName: 'Electric Voltage', prerequisites: ['electric_charge'], p_mastery: 0.44, status: 'shaky', attempts: 4, wrong_streak: 1, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'ohm_law', conceptName: 'Ohm’s Law', prerequisites: ['current', 'voltage'], p_mastery: 0.28, status: 'weak', attempts: 6, wrong_streak: 3, clean_streak: 0, sure_wrong_count: 2 },
      { conceptId: 'resistor_series', conceptName: 'Resistors in Series', prerequisites: ['resistor'], p_mastery: 0.35, status: 'weak', attempts: 5, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'resistor_parallel', conceptName: 'Resistors in Parallel', prerequisites: ['resistor'], p_mastery: 0.15, status: 'weak', attempts: 8, wrong_streak: 5, clean_streak: 0, sure_wrong_count: 3 },
      { conceptId: 'series_circuit', conceptName: 'Series Circuit Analysis', prerequisites: ['resistor_series'], p_mastery: 0.22, status: 'weak', attempts: 6, wrong_streak: 3, clean_streak: 0, sure_wrong_count: 2 },
      { conceptId: 'parallel_circuit', conceptName: 'Parallel Circuit Analysis', prerequisites: ['resistor_parallel'], p_mastery: 0.18, status: 'weak', attempts: 6, wrong_streak: 4, clean_streak: 0, sure_wrong_count: 2 },
      { conceptId: 'kirchoff_current', conceptName: 'Kirchhoff’s Current Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.21, status: 'weak', attempts: 6, wrong_streak: 3, clean_streak: 0, sure_wrong_count: 2 },
      { conceptId: 'kirchoff_voltage', conceptName: 'Kirchhoff’s Voltage Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.16, status: 'weak', attempts: 7, wrong_streak: 4, clean_streak: 0, sure_wrong_count: 3 },
      { conceptId: 'power', conceptName: 'Electrical Power', prerequisites: ['voltage', 'current', 'ohm_law'], p_mastery: 0.32, status: 'weak', attempts: 5, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
    ],
    struggle_points: [
      {
        id: 'sp_tb1',
        conceptId: 'resistor_parallel',
        conceptName: 'Resistors in Parallel',
        rootGapConcept: 'ohm_law',
        rootGapName: 'Ohm’s Law',
        reason: 'Confusing series and parallel voltage rules',
        timestamp: '09:28',
        timeSpentSeconds: 114,
        loopBreakerTriggered: true,
      },
      {
        id: 'sp_tb2',
        conceptId: 'resistor_parallel',
        conceptName: 'Resistors in Parallel',
        rootGapConcept: 'ohm_law',
        rootGapName: 'Ohm’s Law',
        reason: 'Treating parallel resistors as simple addition instead of reciprocal',
        timestamp: '09:42',
        timeSpentSeconds: 98,
        loopBreakerTriggered: true,
      },
      {
        id: 'sp_tb3',
        conceptId: 'resistor_parallel',
        conceptName: 'Resistors in Parallel',
        rootGapConcept: 'resistor',
        rootGapName: 'Resistance Basics',
        reason: 'Calculation error on reciprocal formula (1/R_total)',
        timestamp: '09:55',
        timeSpentSeconds: 120,
        loopBreakerTriggered: true,
      },
      {
        id: 'sp_tb4',
        conceptId: 'kirchoff_voltage',
        conceptName: 'Kirchhoff’s Voltage Law',
        rootGapConcept: 'series_circuit',
        rootGapName: 'Series Circuit Analysis',
        reason: 'Misapplied Kirchhoff loop rule sign conventions',
        timestamp: '10:12',
        timeSpentSeconds: 105,
        loopBreakerTriggered: true,
      },
      {
        id: 'sp_tb5',
        conceptId: 'ohm_law',
        conceptName: 'Ohm’s Law',
        rootGapConcept: 'current',
        rootGapName: 'Electric Current',
        reason: 'Confused V = IR with P = VI power relationship',
        timestamp: '10:29',
        timeSpentSeconds: 88,
        loopBreakerTriggered: true,
      },
      {
        id: 'sp_tb6',
        conceptId: 'parallel_circuit',
        conceptName: 'Parallel Circuit Analysis',
        rootGapConcept: 'resistor_parallel',
        rootGapName: 'Resistors in Parallel',
        reason: 'Thought current drops across every resistor in parallel',
        timestamp: '10:45',
        timeSpentSeconds: 110,
        loopBreakerTriggered: true,
      },
    ],
  },
  {
    id: 'stu_17',
    name: 'Destiny Washington',
    avatarBg: 'bg-rose-700',
    overallScore: 32,
    completionDate: '2026-10-31 13:00',
    totalAttempts: 44,
    isStuckInLoop: true, // HEAVILY STUCK
    hasPrerequisiteGap: true, // Prerequisite gap: Charge & Current
    notes: 'Failed 4 consecutive remedial questions on Current conservation. Triggered LoopBreaker deep dive to root prerequisite.',
    conceptStates: [
      { conceptId: 'electric_charge', conceptName: 'Electric Charge', prerequisites: [], p_mastery: 0.52, status: 'shaky', attempts: 4, wrong_streak: 1, clean_streak: 1, sure_wrong_count: 1 },
      { conceptId: 'current', conceptName: 'Electric Current', prerequisites: ['electric_charge'], p_mastery: 0.31, status: 'weak', attempts: 6, wrong_streak: 3, clean_streak: 0, sure_wrong_count: 2 },
      { conceptId: 'voltage', conceptName: 'Electric Voltage', prerequisites: ['electric_charge'], p_mastery: 0.38, status: 'weak', attempts: 5, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'ohm_law', conceptName: 'Ohm’s Law', prerequisites: ['current', 'voltage'], p_mastery: 0.25, status: 'weak', attempts: 6, wrong_streak: 3, clean_streak: 0, sure_wrong_count: 2 },
      { conceptId: 'resistor_series', conceptName: 'Resistors in Series', prerequisites: ['resistor'], p_mastery: 0.29, status: 'weak', attempts: 6, wrong_streak: 3, clean_streak: 0, sure_wrong_count: 2 },
      { conceptId: 'resistor_parallel', conceptName: 'Resistors in Parallel', prerequisites: ['resistor'], p_mastery: 0.12, status: 'weak', attempts: 7, wrong_streak: 5, clean_streak: 0, sure_wrong_count: 3 },
      { conceptId: 'series_circuit', conceptName: 'Series Circuit Analysis', prerequisites: ['resistor_series'], p_mastery: 0.18, status: 'weak', attempts: 7, wrong_streak: 4, clean_streak: 0, sure_wrong_count: 2 },
      { conceptId: 'parallel_circuit', conceptName: 'Parallel Circuit Analysis', prerequisites: ['resistor_parallel'], p_mastery: 0.16, status: 'weak', attempts: 6, wrong_streak: 3, clean_streak: 0, sure_wrong_count: 2 },
      { conceptId: 'kirchoff_current', conceptName: 'Kirchhoff’s Current Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.18, status: 'weak', attempts: 7, wrong_streak: 4, clean_streak: 0, sure_wrong_count: 3 },
      { conceptId: 'kirchoff_voltage', conceptName: 'Kirchhoff’s Voltage Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.14, status: 'weak', attempts: 8, wrong_streak: 5, clean_streak: 0, sure_wrong_count: 3 },
      { conceptId: 'power', conceptName: 'Electrical Power', prerequisites: ['voltage', 'current', 'ohm_law'], p_mastery: 0.26, status: 'weak', attempts: 5, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
    ],
    struggle_points: [
      {
        id: 'sp_dw1',
        conceptId: 'current',
        conceptName: 'Electric Current',
        rootGapConcept: 'electric_charge',
        rootGapName: 'Electric Charge',
        reason: 'Confusing charge definition with electric current definition',
        timestamp: '13:14',
        timeSpentSeconds: 122,
        loopBreakerTriggered: true,
      },
      {
        id: 'sp_dw2',
        conceptId: 'series_circuit',
        conceptName: 'Series Circuit Analysis',
        rootGapConcept: 'current',
        rootGapName: 'Electric Current',
        reason: 'Confused current conservation with voltage division',
        timestamp: '13:30',
        timeSpentSeconds: 110,
        loopBreakerTriggered: true,
      },
      {
        id: 'sp_dw3',
        conceptId: 'resistor_parallel',
        conceptName: 'Resistors in Parallel',
        rootGapConcept: 'current',
        rootGapName: 'Electric Current',
        reason: 'Confusing series and parallel voltage rules',
        timestamp: '13:48',
        timeSpentSeconds: 118,
        loopBreakerTriggered: true,
      },
      {
        id: 'sp_dw4',
        conceptId: 'kirchoff_current',
        conceptName: 'Kirchhoff’s Current Law',
        rootGapConcept: 'current',
        rootGapName: 'Electric Current',
        reason: 'Forgot that junction current in equals junction current out',
        timestamp: '14:02',
        timeSpentSeconds: 95,
        loopBreakerTriggered: true,
      },
      {
        id: 'sp_dw5',
        conceptId: 'parallel_circuit',
        conceptName: 'Parallel Circuit Analysis',
        rootGapConcept: 'resistor_parallel',
        rootGapName: 'Resistors in Parallel',
        reason: 'Thought current drops across every resistor in parallel',
        timestamp: '14:21',
        timeSpentSeconds: 130,
        loopBreakerTriggered: true,
      },
      {
        id: 'sp_dw6',
        conceptId: 'kirchoff_voltage',
        conceptName: 'Kirchhoff’s Voltage Law',
        rootGapConcept: 'voltage',
        rootGapName: 'Electric Voltage',
        reason: 'Misapplied Kirchhoff loop rule sign conventions',
        timestamp: '14:39',
        timeSpentSeconds: 104,
        loopBreakerTriggered: true,
      },
      {
        id: 'sp_dw7',
        conceptId: 'resistor_parallel',
        conceptName: 'Resistors in Parallel',
        rootGapConcept: 'resistor',
        rootGapName: 'Resistance Basics',
        reason: 'Treating parallel resistors as simple addition instead of reciprocal',
        timestamp: '14:55',
        timeSpentSeconds: 115,
        loopBreakerTriggered: true,
      },
    ],
  },
  {
    id: 'stu_18',
    name: 'Leo Ramirez',
    avatarBg: 'bg-orange-700',
    overallScore: 29,
    completionDate: '2026-10-31 11:40',
    totalAttempts: 47,
    isStuckInLoop: true, // HEAVILY STUCK
    hasPrerequisiteGap: true, // Prerequisite gap: Charge, Voltage, Ohm's law
    notes: '8 LoopBreakers triggered across quiz session. Severe misconception regarding potential difference vs current flow.',
    conceptStates: [
      { conceptId: 'electric_charge', conceptName: 'Electric Charge', prerequisites: [], p_mastery: 0.45, status: 'shaky', attempts: 5, wrong_streak: 2, clean_streak: 0, sure_wrong_count: 1 },
      { conceptId: 'current', conceptName: 'Electric Current', prerequisites: ['electric_charge'], p_mastery: 0.32, status: 'weak', attempts: 6, wrong_streak: 3, clean_streak: 0, sure_wrong_count: 2 },
      { conceptId: 'voltage', conceptName: 'Electric Voltage', prerequisites: ['electric_charge'], p_mastery: 0.28, status: 'weak', attempts: 6, wrong_streak: 3, clean_streak: 0, sure_wrong_count: 2 },
      { conceptId: 'ohm_law', conceptName: 'Ohm’s Law', prerequisites: ['current', 'voltage'], p_mastery: 0.21, status: 'weak', attempts: 7, wrong_streak: 4, clean_streak: 0, sure_wrong_count: 3 },
      { conceptId: 'resistor_series', conceptName: 'Resistors in Series', prerequisites: ['resistor'], p_mastery: 0.26, status: 'weak', attempts: 6, wrong_streak: 3, clean_streak: 0, sure_wrong_count: 2 },
      { conceptId: 'resistor_parallel', conceptName: 'Resistors in Parallel', prerequisites: ['resistor'], p_mastery: 0.10, status: 'weak', attempts: 8, wrong_streak: 5, clean_streak: 0, sure_wrong_count: 4 },
      { conceptId: 'series_circuit', conceptName: 'Series Circuit Analysis', prerequisites: ['resistor_series'], p_mastery: 0.15, status: 'weak', attempts: 7, wrong_streak: 4, clean_streak: 0, sure_wrong_count: 2 },
      { conceptId: 'parallel_circuit', conceptName: 'Parallel Circuit Analysis', prerequisites: ['resistor_parallel'], p_mastery: 0.12, status: 'weak', attempts: 7, wrong_streak: 4, clean_streak: 0, sure_wrong_count: 2 },
      { conceptId: 'kirchoff_current', conceptName: 'Kirchhoff’s Current Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.14, status: 'weak', attempts: 8, wrong_streak: 5, clean_streak: 0, sure_wrong_count: 3 },
      { conceptId: 'kirchoff_voltage', conceptName: 'Kirchhoff’s Voltage Law', prerequisites: ['series_circuit', 'parallel_circuit'], p_mastery: 0.11, status: 'weak', attempts: 8, wrong_streak: 5, clean_streak: 0, sure_wrong_count: 3 },
      { conceptId: 'power', conceptName: 'Electrical Power', prerequisites: ['voltage', 'current', 'ohm_law'], p_mastery: 0.22, status: 'weak', attempts: 6, wrong_streak: 3, clean_streak: 0, sure_wrong_count: 2 },
    ],
    struggle_points: [
      {
        id: 'sp_lr1',
        conceptId: 'voltage',
        conceptName: 'Electric Voltage',
        rootGapConcept: 'electric_charge',
        rootGapName: 'Electric Charge',
        reason: 'Confusing current units with voltage units',
        timestamp: '11:55',
        timeSpentSeconds: 125,
        loopBreakerTriggered: true,
      },
      {
        id: 'sp_lr2',
        conceptId: 'ohm_law',
        conceptName: 'Ohm’s Law',
        rootGapConcept: 'voltage',
        rootGapName: 'Electric Voltage',
        reason: 'Confused V = IR with P = VI power relationship',
        timestamp: '12:10',
        timeSpentSeconds: 118,
        loopBreakerTriggered: true,
      },
      {
        id: 'sp_lr3',
        conceptId: 'resistor_parallel',
        conceptName: 'Resistors in Parallel',
        rootGapConcept: 'ohm_law',
        rootGapName: 'Ohm’s Law',
        reason: 'Confusing series and parallel voltage rules',
        timestamp: '12:28',
        timeSpentSeconds: 135,
        loopBreakerTriggered: true,
      },
      {
        id: 'sp_lr4',
        conceptId: 'resistor_parallel',
        conceptName: 'Resistors in Parallel',
        rootGapConcept: 'resistor',
        rootGapName: 'Resistance Basics',
        reason: 'Treating parallel resistors as simple addition instead of reciprocal',
        timestamp: '12:44',
        timeSpentSeconds: 140,
        loopBreakerTriggered: true,
      },
      {
        id: 'sp_lr5',
        conceptId: 'kirchoff_voltage',
        conceptName: 'Kirchhoff’s Voltage Law',
        rootGapConcept: 'series_circuit',
        rootGapName: 'Series Circuit Analysis',
        reason: 'Misapplied Kirchhoff loop rule sign conventions',
        timestamp: '13:02',
        timeSpentSeconds: 112,
        loopBreakerTriggered: true,
      },
      {
        id: 'sp_lr6',
        conceptId: 'kirchoff_current',
        conceptName: 'Kirchhoff’s Current Law',
        rootGapConcept: 'current',
        rootGapName: 'Electric Current',
        reason: 'Forgot that junction current in equals junction current out',
        timestamp: '13:18',
        timeSpentSeconds: 105,
        loopBreakerTriggered: true,
      },
      {
        id: 'sp_lr7',
        conceptId: 'parallel_circuit',
        conceptName: 'Parallel Circuit Analysis',
        rootGapConcept: 'resistor_parallel',
        rootGapName: 'Resistors in Parallel',
        reason: 'Thought current drops across every resistor in parallel',
        timestamp: '13:34',
        timeSpentSeconds: 122,
        loopBreakerTriggered: true,
      },
      {
        id: 'sp_lr8',
        conceptId: 'series_circuit',
        conceptName: 'Series Circuit Analysis',
        rootGapConcept: 'resistor_series',
        rootGapName: 'Resistors in Series',
        reason: 'Confused current conservation with voltage division',
        timestamp: '13:51',
        timeSpentSeconds: 116,
        loopBreakerTriggered: true,
      },
    ],
  },
];

// ============================================================================
// Main TeacherDashboard Component
// ============================================================================

export interface TeacherDashboardProps {
  students?: SimulatedStudent[];
  chapterTitle?: string;
  onRefreshData?: () => void;
  onSelectStudent?: (studentId: string) => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  students = MOCK_SIMULATED_STUDENTS,
  chapterTitle = 'Electricity & Circuits (Class 10 / AP Physics 1)',
  onRefreshData,
  onSelectStudent,
}) => {
  // --------------------------------------------------------------------------
  // State Management
  // --------------------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'stuck' | 'prereq_gap' | 'average' | 'top'
  >('all');
  const [selectedStudentForModal, setSelectedStudentForModal] =
    useState<SimulatedStudent | null>(null);
  const [sortField, setSortField] = useState<'score' | 'name' | 'alerts' | 'weak'>(
    'alerts'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedConceptFilter, setSelectedConceptFilter] = useState<string | null>(
    null
  );

  // --------------------------------------------------------------------------
  // 2. Metric Cards & High-Level Aggregates Calculations
  // --------------------------------------------------------------------------
  const totalStudentsCount = students.length;

  // A. Class Average Score: Percentage calculated across all simulated student runs
  const classAverageScore = useMemo(() => {
    if (totalStudentsCount === 0) return 0;
    const sum = students.reduce((acc, curr) => acc + curr.overallScore, 0);
    return Math.round(sum / totalStudentsCount);
  }, [students, totalStudentsCount]);

  // B. Total Struggle Alerts: Aggregate count of how many loop breakers were fired
  const totalStruggleAlerts = useMemo(() => {
    return students.reduce((acc, student) => {
      const studentAlerts = student.struggle_points.filter(
        (sp) => sp.loopBreakerTriggered
      ).length;
      return acc + studentAlerts;
    }, 0);
  }, [students]);

  // Concept Map for quick lookups
  const conceptNameMap = useMemo(() => {
    const map = new Map<string, string>();
    CHAPTER_CONCEPTS.forEach((c) => map.set(c.id, c.name));
    return map;
  }, []);

  // C. Active Class Gaps: Concepts currently sitting in "Weak" status for > 20% of class
  // & 3. Class Gaps & Misconception Insights Data Aggregation
  const { activeClassGapsCount, rankedClassGaps } = useMemo(() => {
    const conceptStats = new Map<
      string,
      {
        weakCount: number;
        shakyCount: number;
        understoodCount: number;
        affectedStudentIds: string[];
        reasonsMap: Map<string, number>;
      }
    >();

    // Initialize all concepts
    CHAPTER_CONCEPTS.forEach((c) => {
      conceptStats.set(c.id, {
        weakCount: 0,
        shakyCount: 0,
        understoodCount: 0,
        affectedStudentIds: [],
        reasonsMap: new Map<string, number>(),
      });
    });

    // Populate counts from each student's conceptStates
    students.forEach((student) => {
      student.conceptStates.forEach((cs) => {
        const stats = conceptStats.get(cs.conceptId);
        if (!stats) return;

        if (cs.status === 'weak') {
          stats.weakCount += 1;
          stats.affectedStudentIds.push(student.id);
        } else if (cs.status === 'shaky') {
          stats.shakyCount += 1;
        } else if (cs.status === 'understood') {
          stats.understoodCount += 1;
        }
      });

      // Aggregate qualitative reasons from struggle_points
      student.struggle_points.forEach((sp) => {
        const stats = conceptStats.get(sp.conceptId);
        if (stats && sp.reason) {
          const currentCount = stats.reasonsMap.get(sp.reason) || 0;
          stats.reasonsMap.set(sp.reason, currentCount + 1);
        }
      });
    });

    const gapsList: ClassGapInsight[] = [];
    let activeGapsThresholdCount = 0;
    const thresholdPercentage = 0.2; // 20% threshold

    conceptStats.forEach((stats, conceptId) => {
      const weakRatio = stats.weakCount / totalStudentsCount;
      const isOverThreshold = weakRatio > thresholdPercentage;

      if (isOverThreshold) {
        activeGapsThresholdCount += 1;
      }

      // Convert aggregated reasons map to sorted array
      const sortedReasons = Array.from(stats.reasonsMap.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count);

      let severity: 'critical' | 'high' | 'moderate' = 'moderate';
      if (weakRatio >= 0.35) {
        severity = 'critical';
      } else if (weakRatio >= 0.2) {
        severity = 'high';
      }

      const conceptDef = CHAPTER_CONCEPTS.find((c) => c.id === conceptId);

      // Determine likely root prerequisite gap
      let rootPrereqGap: string | null = null;
      if (conceptDef && conceptDef.prerequisites.length > 0) {
        rootPrereqGap = conceptDef.prerequisites[0];
      }

      // Only include concepts that have at least 1 weak or shaky failure
      if (stats.weakCount > 0 || stats.shakyCount > 1) {
        gapsList.push({
          conceptId,
          conceptName: conceptDef ? conceptDef.name : conceptId,
          prerequisites: conceptDef ? conceptDef.prerequisites : [],
          weakCount: stats.weakCount,
          shakyCount: stats.shakyCount,
          understoodCount: stats.understoodCount,
          totalCount: totalStudentsCount,
          weakPercentage: Math.round(weakRatio * 100),
          severity,
          rootPrereqGap,
          aggregatedReasons: sortedReasons,
          affectedStudentIds: stats.affectedStudentIds,
        });
      }
    });

    // Rank by severity: weak count descending, then total struggles
    gapsList.sort((a, b) => {
      if (b.weakCount !== a.weakCount) {
        return b.weakCount - a.weakCount;
      }
      return b.shakyCount - a.shakyCount;
    });

    return {
      activeClassGapsCount: activeGapsThresholdCount,
      rankedClassGaps: gapsList,
    };
  }, [students, totalStudentsCount]);

  // Micro aggregates for header highlights
  const stuckStudentsCount = useMemo(
    () => students.filter((s) => s.isStuckInLoop).length,
    [students]
  );
  const prereqStruggleCount = useMemo(
    () => students.filter((s) => s.hasPrerequisiteGap).length,
    [students]
  );

  // --------------------------------------------------------------------------
  // 4. Student Roster Filter & Sort
  // --------------------------------------------------------------------------
  const filteredAndSortedStudents = useMemo(() => {
    return students
      .filter((student) => {
        // Text Search
        const query = searchQuery.toLowerCase().trim();
        const matchesQuery =
          !query ||
          student.name.toLowerCase().includes(query) ||
          student.struggle_points.some((sp) =>
            sp.reason.toLowerCase().includes(query) ||
            sp.conceptName.toLowerCase().includes(query)
          );

        if (!matchesQuery) return false;

        // Concept Filter from clicking an insight card
        if (selectedConceptFilter) {
          const hasWeakConcept = student.conceptStates.some(
            (cs) => cs.conceptId === selectedConceptFilter && cs.status === 'weak'
          );
          if (!hasWeakConcept) return false;
        }

        // Quick Filter Tabs
        if (statusFilter === 'stuck') {
          return student.isStuckInLoop;
        }
        if (statusFilter === 'prereq_gap') {
          return student.hasPrerequisiteGap;
        }
        if (statusFilter === 'average') {
          return (
            student.overallScore >= 50 &&
            student.overallScore <= 80 &&
            !student.isStuckInLoop
          );
        }
        if (statusFilter === 'top') {
          return student.overallScore > 80;
        }

        return true;
      })
      .sort((a, b) => {
        let modifier = sortOrder === 'asc' ? 1 : -1;
        if (sortField === 'score') {
          return (a.overallScore - b.overallScore) * modifier;
        }
        if (sortField === 'name') {
          return a.name.localeCompare(b.name) * modifier;
        }
        if (sortField === 'alerts') {
          const aAlerts = a.struggle_points.filter((sp) => sp.loopBreakerTriggered).length;
          const bAlerts = b.struggle_points.filter((sp) => sp.loopBreakerTriggered).length;
          return (aAlerts - bAlerts) * modifier;
        }
        if (sortField === 'weak') {
          const aWeak = a.conceptStates.filter((cs) => cs.status === 'weak').length;
          const bWeak = b.conceptStates.filter((cs) => cs.status === 'weak').length;
          return (aWeak - bWeak) * modifier;
        }
        return 0;
      });
  }, [
    students,
    searchQuery,
    statusFilter,
    selectedConceptFilter,
    sortField,
    sortOrder,
  ]);

  // Helper to count student statuses
  const getStudentStatusCounts = (student: SimulatedStudent) => {
    let understood = 0;
    let shaky = 0;
    let weak = 0;
    student.conceptStates.forEach((cs) => {
      if (cs.status === 'understood') understood++;
      else if (cs.status === 'shaky') shaky++;
      else if (cs.status === 'weak') weak++;
    });
    return { understood, shaky, weak };
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans antialiased">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">
                  LoopBreaker
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 font-medium">
                  Teacher Diagnostics
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Remediation Engine & Concept Mastery Tracker
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="text-right hidden md:block">
              <p className="text-xs text-slate-400">Class Cohort</p>
              <p className="text-sm font-semibold text-slate-200">
                Physics Period 3 (18 Students)
              </p>
            </div>
            <button
              type="button"
              onClick={onRefreshData}
              title="Refresh simulated metrics"
              className="inline-flex items-center px-3 py-1.5 border border-slate-700 hover:border-slate-600 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-800 transition"
            >
              <svg
                className="w-3.5 h-3.5 mr-1.5 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh Sim
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Chapter Overview Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/50">
                Active Chapter
              </span>
              <span className="text-xs text-slate-400">
                Aggregated from 18 student diagnostic runs
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {chapterTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-red-950/60 text-red-300 border border-red-800/60">
              <span className="w-2 h-2 mr-2 rounded-full bg-red-500 animate-pulse" />
              {stuckStudentsCount} Stuck in Loop
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-amber-950/60 text-amber-300 border border-amber-800/60">
              <span className="w-2 h-2 mr-2 rounded-full bg-amber-500" />
              {prereqStruggleCount} Prerequisite Gaps
            </span>
          </div>
        </div>

        {/* ================================================================== */}
        {/* 2. METRIC CARDS & HIGH-LEVEL AGGREGATES                            */}
        {/* ================================================================== */}
        <section aria-label="Class Metrics Summary">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Metric 1: Class Average Score */}
            <div className="relative overflow-hidden bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 shadow-xl backdrop-blur transition hover:border-slate-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Class Average Score
                  </p>
                  <div className="flex items-baseline space-x-2 mt-2">
                    <span className="text-4xl font-extrabold text-white tracking-tight">
                      {classAverageScore}%
                    </span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded ${
                        classAverageScore >= 75
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                          : classAverageScore >= 60
                          ? 'bg-amber-950/80 text-amber-400 border border-amber-800'
                          : 'bg-red-950/80 text-red-400 border border-red-800'
                      }`}
                    >
                      {classAverageScore >= 75
                        ? 'Mastery On Track'
                        : classAverageScore >= 60
                        ? 'Needs Targeted Review'
                        : 'Severe Roadblocks'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Calculated across all {totalStudentsCount} simulated student runs
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
                <span>Top performer: 94%</span>
                <span>Median: 67%</span>
                <span>Lowest: 29%</span>
              </div>
            </div>

            {/* Metric 2: Active Class Gaps */}
            <div className="relative overflow-hidden bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 shadow-xl backdrop-blur transition hover:border-slate-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Active Class Gaps
                  </p>
                  <div className="flex items-baseline space-x-2 mt-2">
                    <span className="text-4xl font-extrabold text-amber-400 tracking-tight">
                      {activeClassGapsCount}
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800">
                      &gt; 20% of class weak
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Concepts where at least 4 students are currently stuck in Weak status
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
                <span className="truncate">Top gap: Resistors in Parallel</span>
                <span className="text-amber-400 font-medium">44% Weak</span>
              </div>
            </div>

            {/* Metric 3: Total Struggle Alerts */}
            <div className="relative overflow-hidden bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 shadow-xl backdrop-blur transition hover:border-slate-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Total Struggle Alerts
                  </p>
                  <div className="flex items-baseline space-x-2 mt-2">
                    <span className="text-4xl font-extrabold text-red-400 tracking-tight">
                      {totalStruggleAlerts}
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-red-950/80 text-red-300 border border-red-800">
                      Loop Breakers Fired
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Times the engine intervened to divert students to prerequisite branches
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 flex-shrink-0">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
                <span>Avg 2.3 loops / student</span>
                <span className="text-red-400 font-medium">3 heavily stuck</span>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================== */}
        {/* 3. CLASS GAPS & MISCONCEPTION INSIGHTS                             */}
        {/* ================================================================== */}
        <section aria-label="Conceptual Roadblocks & Misconceptions">
          <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 shadow-xl backdrop-blur">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-700/60 gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    Class Gaps & Misconception Insights
                  </h2>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                    Why? Survey Aggregates
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Roadblocks ranked by failure severity with qualitative reasons extracted directly from student surveys
                </p>
              </div>

              {selectedConceptFilter && (
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-indigo-300 bg-indigo-950/80 px-2.5 py-1 rounded-lg border border-indigo-700 flex items-center gap-1.5">
                    Filtering roster by: <strong>{conceptNameMap.get(selectedConceptFilter) || selectedConceptFilter}</strong>
                    <button
                      type="button"
                      onClick={() => setSelectedConceptFilter(null)}
                      className="text-slate-400 hover:text-white font-bold ml-1"
                    >
                      ×
                    </button>
                  </span>
                </div>
              )}
            </div>

            {/* Ranked Gaps Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-6">
              {rankedClassGaps.slice(0, 3).map((gap, index) => {
                const isSelected = selectedConceptFilter === gap.conceptId;
                return (
                  <div
                    key={gap.conceptId}
                    className={`relative rounded-xl p-5 border transition flex flex-col justify-between ${
                      isSelected
                        ? 'border-indigo-500 bg-slate-800/90 ring-2 ring-indigo-500/40 shadow-lg'
                        : gap.severity === 'critical'
                        ? 'border-red-500/40 bg-gradient-to-b from-red-950/20 to-slate-800/80 hover:border-red-500/70'
                        : gap.severity === 'high'
                        ? 'border-amber-500/40 bg-gradient-to-b from-amber-950/20 to-slate-800/80 hover:border-amber-500/70'
                        : 'border-slate-700 bg-slate-800/70 hover:border-slate-600'
                    }`}
                  >
                    <div>
                      {/* Header with Severity & Rank */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900/80 text-slate-300 border border-slate-700">
                              #{index + 1} Roadblock
                            </span>
                            {gap.severity === 'critical' && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                                Critical Gap
                              </span>
                            )}
                            {gap.severity === 'high' && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                                High Gap
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-bold text-white mt-2">
                            {gap.conceptName}
                          </h3>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className="text-2xl font-black text-red-400">
                            {gap.weakPercentage}%
                          </span>
                          <span className="block text-[10px] text-slate-400 uppercase tracking-wider">
                            {gap.weakCount}/{gap.totalCount} Weak
                          </span>
                        </div>
                      </div>

                      {/* Visual Status Bar */}
                      <div className="mt-3">
                        <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden flex">
                          <div
                            style={{
                              width: `${(gap.understoodCount / gap.totalCount) * 100}%`,
                            }}
                            className="bg-emerald-500 h-full"
                            title={`Understood: ${gap.understoodCount}`}
                          />
                          <div
                            style={{
                              width: `${(gap.shakyCount / gap.totalCount) * 100}%`,
                            }}
                            className="bg-amber-500 h-full"
                            title={`Shaky: ${gap.shakyCount}`}
                          />
                          <div
                            style={{
                              width: `${(gap.weakCount / gap.totalCount) * 100}%`,
                            }}
                            className="bg-red-500 h-full"
                            title={`Weak: ${gap.weakCount}`}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                          <span className="text-emerald-400">
                            {gap.understoodCount} Understood
                          </span>
                          <span className="text-amber-400">{gap.shakyCount} Shaky</span>
                          <span className="text-red-400">{gap.weakCount} Weak</span>
                        </div>
                      </div>

                      {/* Root Prerequisite Gap Link */}
                      {gap.rootPrereqGap && (
                        <div className="mt-3 p-2 rounded-lg bg-slate-900/70 border border-slate-700/60 text-xs">
                          <span className="text-slate-400">Engine Root Link: </span>
                          <span className="font-semibold text-indigo-300">
                            {conceptNameMap.get(gap.rootPrereqGap) || gap.rootPrereqGap}
                          </span>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            LoopBreaker redirects struggling students here to rebuild foundation.
                          </p>
                        </div>
                      )}

                      {/* Aggregated Qualitative Survey Reasons */}
                      <div className="mt-4">
                        <p className="text-xs font-semibold text-slate-300 mb-2 flex items-center">
                          <svg
                            className="w-3.5 h-3.5 mr-1 text-indigo-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                            />
                          </svg>
                          Aggregated "Why?" Survey Logs:
                        </p>
                        <div className="space-y-1.5">
                          {gap.aggregatedReasons.length > 0 ? (
                            gap.aggregatedReasons.slice(0, 3).map((item, rIdx) => (
                              <div
                                key={rIdx}
                                className="flex items-start text-xs bg-slate-900/60 p-2 rounded border border-slate-800"
                              >
                                <span className="font-bold text-red-400 mr-1.5 flex-shrink-0">
                                  {item.count} flagged:
                                </span>
                                <span className="text-slate-300 leading-tight">
                                  "{item.reason}"
                                </span>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-500 italic">
                              No explicit survey reasons logged for this concept.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Filter Action Button */}
                    <div className="mt-5 pt-3 border-t border-slate-700/60 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedConceptFilter === gap.conceptId) {
                            setSelectedConceptFilter(null);
                          } else {
                            setSelectedConceptFilter(gap.conceptId);
                          }
                        }}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg transition w-full text-center ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-700/60 hover:bg-slate-700 text-slate-200'
                        }`}
                      >
                        {isSelected
                          ? 'Showing Affected Students (Clear)'
                          : `Filter Roster (${gap.weakCount} Weak Students)`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Additional Minor Roadblocks Accordion / Bar List */}
            {rankedClassGaps.length > 3 && (
              <div className="mt-6 pt-5 border-t border-slate-700/60">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Other Secondary Roadblocks in Chapter
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {rankedClassGaps.slice(3).map((gap) => (
                    <div
                      key={gap.conceptId}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-xs hover:border-slate-700 transition"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                        <span className="font-semibold text-slate-200">
                          {gap.conceptName}
                        </span>
                        {gap.rootPrereqGap && (
                          <span className="text-slate-500 hidden sm:inline">
                            (prereq: {conceptNameMap.get(gap.rootPrereqGap) || gap.rootPrereqGap})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-slate-400">
                          {gap.weakCount} weak / {gap.shakyCount} shaky
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedConceptFilter(gap.conceptId)}
                          className="text-indigo-400 hover:text-indigo-300 font-medium underline"
                        >
                          Filter
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ================================================================== */}
        {/* 4. STUDENT ROSTER GRID & TABLE                                     */}
        {/* ================================================================== */}
        <section aria-label="Student Roster and Detailed Diagnostic Profiles">
          <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 shadow-xl backdrop-blur">
            {/* Header & Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-700/60">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Student Roster & Diagnostic Grid</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-normal">
                    {filteredAndSortedStudents.length} of {totalStudentsCount} shown
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Inspect student mastery distributions, loop trigger frequency, and logged misconceptions
                </p>
              </div>

              {/* Search Bar & Filter Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                {/* Search Input */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name, concept, or survey reason..."
                    className="w-full sm:w-64 pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-white"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Quick Sort Dropdown */}
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as any)}
                  className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="alerts">Sort by: Struggle Alerts (High to Low)</option>
                  <option value="score">Sort by: Chapter Score</option>
                  <option value="weak">Sort by: Weak Concepts Count</option>
                  <option value="name">Sort by: Student Name</option>
                </select>

                <button
                  type="button"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white transition"
                  title={`Order: ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>

            {/* Quick Filter Pill Buttons */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <span className="text-xs text-slate-400 mr-1">Quick Filters:</span>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setSelectedConceptFilter(null);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  statusFilter === 'all' && !selectedConceptFilter
                    ? 'bg-indigo-600 text-white shadow'
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700'
                }`}
              >
                All Students ({totalStudentsCount})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('stuck')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  statusFilter === 'stuck'
                    ? 'bg-red-600 text-white shadow'
                    : 'bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-800/60'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                Show Stuck Students ({stuckStudentsCount})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('prereq_gap')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  statusFilter === 'prereq_gap'
                    ? 'bg-amber-600 text-white shadow'
                    : 'bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border border-amber-800/60'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Show Struggling Prerequisites ({prereqStruggleCount})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('average')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  statusFilter === 'average'
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700'
                }`}
              >
                Average / Shaky Cluster (11)
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('top')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  statusFilter === 'top'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-800/60'
                }`}
              >
                Top Performers (4)
              </button>
            </div>

            {/* Responsive Table Layout */}
            <div className="mt-5 overflow-x-auto rounded-xl border border-slate-700/80">
              <table className="w-full text-left text-xs text-slate-200">
                <thead className="bg-slate-950/80 text-slate-400 uppercase text-[11px] tracking-wider border-b border-slate-700">
                  <tr>
                    <th scope="col" className="py-3 px-4">
                      Student
                    </th>
                    <th scope="col" className="py-3 px-4">
                      Chapter Score
                    </th>
                    <th scope="col" className="py-3 px-4">
                      Concept Mastery Status
                    </th>
                    <th scope="col" className="py-3 px-4">
                      Loop Breaker Alerts
                    </th>
                    <th scope="col" className="py-3 px-4 hidden md:table-cell">
                      Specific Logged Struggle Reason
                    </th>
                    <th scope="col" className="py-3 px-4 text-right">
                      Diagnostic Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                  {filteredAndSortedStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400">
                        <svg
                          className="w-8 h-8 mx-auto text-slate-500 mb-2"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        No students match the selected filters or query.
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedStudents.map((student) => {
                      const counts = getStudentStatusCounts(student);
                      const loopAlertCount = student.struggle_points.filter(
                        (sp) => sp.loopBreakerTriggered
                      ).length;
                      const primaryStruggle =
                        student.struggle_points.length > 0
                          ? student.struggle_points[0]
                          : null;

                      return (
                        <tr
                          key={student.id}
                          className={`hover:bg-slate-800/80 transition ${
                            student.isStuckInLoop
                              ? 'bg-red-950/10'
                              : student.hasPrerequisiteGap
                              ? 'bg-amber-950/10'
                              : ''
                          }`}
                        >
                          {/* Student Info */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-3">
                              <div
                                className={`w-8 h-8 rounded-full ${student.avatarBg} text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow`}
                              >
                                {student.name
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')}
                              </div>
                              <div>
                                <div className="font-semibold text-white flex items-center gap-1.5">
                                  <span>{student.name}</span>
                                  {student.isStuckInLoop && (
                                    <span
                                      className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-900/80 text-red-300 border border-red-700"
                                      title="Student is heavily stuck in loop triggers"
                                    >
                                      Stuck
                                    </span>
                                  )}
                                  {student.hasPrerequisiteGap && !student.isStuckInLoop && (
                                    <span
                                      className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-900/80 text-amber-300 border border-amber-700"
                                      title="Foundational prerequisite gap detected"
                                    >
                                      Prereq Gap
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  ID: {student.id}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Overall Score */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <span
                                className={`font-black text-sm ${
                                  student.overallScore >= 80
                                    ? 'text-emerald-400'
                                    : student.overallScore >= 60
                                    ? 'text-amber-400'
                                    : 'text-red-400'
                                }`}
                              >
                                {student.overallScore}%
                              </span>
                              <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden hidden sm:block">
                                <div
                                  className={`h-full ${
                                    student.overallScore >= 80
                                      ? 'bg-emerald-500'
                                      : student.overallScore >= 60
                                      ? 'bg-amber-500'
                                      : 'bg-red-500'
                                  }`}
                                  style={{ width: `${student.overallScore}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {student.totalAttempts} total attempts
                            </span>
                          </td>

                          {/* Concept Status Distribution Counts */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center space-x-1.5">
                              <span
                                className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800 text-[11px] font-medium"
                                title="Concepts Understood"
                              >
                                {counts.understood} Understood
                              </span>
                              <span
                                className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800 text-[11px] font-medium"
                                title="Concepts Shaky"
                              >
                                {counts.shaky} Shaky
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                                  counts.weak > 0
                                    ? 'bg-red-950/80 text-red-300 border border-red-800 font-bold'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}
                                title="Concepts Weak"
                              >
                                {counts.weak} Weak
                              </span>
                            </div>
                          </td>

                          {/* Struggle Points / Loop Alerts Count */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {loopAlertCount > 0 ? (
                              <div className="flex items-center space-x-1.5">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 ${
                                    loopAlertCount >= 5
                                      ? 'bg-red-900 text-red-200 border border-red-600 animate-pulse'
                                      : loopAlertCount >= 2
                                      ? 'bg-amber-900/80 text-amber-200 border border-amber-700'
                                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                                  }`}
                                >
                                  <svg
                                    className="w-3 h-3"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                    />
                                  </svg>
                                  {loopAlertCount} {loopAlertCount === 1 ? 'Alert' : 'Alerts'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-emerald-400 font-medium">
                                Clean Run (0 Alerts)
                              </span>
                            )}
                          </td>

                          {/* Specific Logged Struggle Reason */}
                          <td className="py-3.5 px-4 hidden md:table-cell max-w-xs">
                            {primaryStruggle ? (
                              <div>
                                <span className="font-semibold text-slate-300 text-xs truncate block">
                                  {primaryStruggle.conceptName}:
                                </span>
                                <span className="text-slate-400 text-[11px] line-clamp-1 italic">
                                  "{primaryStruggle.reason}"
                                </span>
                                {primaryStruggle.rootGapName && (
                                  <span className="text-[10px] text-indigo-400 block mt-0.5">
                                    Root Prereq: {primaryStruggle.rootGapName}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">
                                No struggle points flagged
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStudentForModal(student);
                                if (onSelectStudent) onSelectStudent(student.id);
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition inline-flex items-center gap-1"
                            >
                              <span>Inspect Gaps</span>
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {/* ==================================================================== */}
      {/* STUDENT DIAGNOSTIC MODAL / DRAWER                                    */}
      {/* ==================================================================== */}
      {selectedStudentForModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
        >
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-12 h-12 rounded-xl ${selectedStudentForModal.avatarBg} text-white font-bold text-base flex items-center justify-center flex-shrink-0 shadow-lg`}
                >
                  {selectedStudentForModal.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-xl font-bold text-white">
                      {selectedStudentForModal.name}
                    </h3>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                      {selectedStudentForModal.id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Completed session: {selectedStudentForModal.completionDate}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStudentForModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
                title="Close modal"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Student Score & Diagnostic Flags Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 uppercase font-medium">
                  Overall Score
                </span>
                <p className="text-2xl font-black text-white mt-1">
                  {selectedStudentForModal.overallScore}%
                </p>
                <span className="text-xs text-slate-400">
                  {selectedStudentForModal.totalAttempts} questions answered
                </span>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 uppercase font-medium">
                  Loop Breaker Alerts
                </span>
                <p
                  className={`text-2xl font-black mt-1 ${
                    selectedStudentForModal.isStuckInLoop
                      ? 'text-red-400'
                      : 'text-amber-400'
                  }`}
                >
                  {
                    selectedStudentForModal.struggle_points.filter(
                      (sp) => sp.loopBreakerTriggered
                    ).length
                  }{' '}
                  Fired
                </p>
                <span className="text-xs text-slate-400">
                  {selectedStudentForModal.isStuckInLoop
                    ? 'Loop triggers active'
                    : 'Remediations resolved'}
                </span>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 uppercase font-medium">
                  Prerequisite Status
                </span>
                <p
                  className={`text-sm font-bold mt-1 ${
                    selectedStudentForModal.hasPrerequisiteGap
                      ? 'text-red-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {selectedStudentForModal.hasPrerequisiteGap
                    ? 'Root Gaps Detected'
                    : 'Foundations Solid'}
                </p>
                <span className="text-xs text-slate-400">
                  {selectedStudentForModal.notes || 'Normal progression profile'}
                </span>
              </div>
            </div>

            {/* Concept Breakdown Table */}
            <div>
              <h4 className="text-sm font-bold text-white mb-3 flex items-center justify-between">
                <span>Concept Mastery Matrix (P_Mastery)</span>
                <span className="text-xs text-slate-400 font-normal">
                  Threshold: &ge; 0.8 Understood | &ge; 0.4 Shaky | &lt; 0.4 Weak
                </span>
              </h4>
              <div className="space-y-2">
                {selectedStudentForModal.conceptStates.map((cs) => (
                  <div
                    key={cs.conceptId}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/50 border border-slate-800 text-xs"
                  >
                    <div className="flex-1 pr-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-slate-200">
                          {cs.conceptName}
                        </span>
                        {cs.sure_wrong_count > 0 && (
                          <span className="text-[10px] bg-red-950 text-red-300 px-1.5 py-0.2 rounded border border-red-800">
                            Misconception ({cs.sure_wrong_count} confident wrong)
                          </span>
                        )}
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
                        <div
                          className={`h-full ${
                            cs.status === 'understood'
                              ? 'bg-emerald-500'
                              : cs.status === 'shaky'
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.round(cs.p_mastery * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 text-right">
                      <span className="font-mono text-slate-300">
                        {Math.round(cs.p_mastery * 100)}%
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          cs.status === 'understood'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : cs.status === 'shaky'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-red-950 text-red-300 border border-red-800'
                        }`}
                      >
                        {cs.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* History Log of Struggle Points & Survey Responses */}
            <div>
              <h4 className="text-sm font-bold text-white mb-3 flex items-center justify-between">
                <span>History Log: Struggle Points & Survey Reasons</span>
                <span className="text-xs text-slate-400 font-normal">
                  {selectedStudentForModal.struggle_points.length} events recorded
                </span>
              </h4>

              {selectedStudentForModal.struggle_points.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 text-center text-xs text-slate-400">
                  No struggle points or loop breaker activations logged for this student!
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedStudentForModal.struggle_points.map((sp, idx) => (
                    <div
                      key={sp.id || idx}
                      className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200">
                          {sp.conceptName}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-slate-500 text-[11px]">
                            {sp.timestamp} ({sp.timeSpentSeconds}s spent)
                          </span>
                          {sp.loopBreakerTriggered && (
                            <span className="px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 text-[10px] font-semibold">
                              Loop Breaker Fired
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-start text-slate-300 bg-slate-900/80 p-2 rounded border border-slate-800">
                        <span className="text-indigo-400 font-medium mr-1.5 flex-shrink-0">
                          Survey Reason:
                        </span>
                        <span className="italic">"{sp.reason}"</span>
                      </div>

                      {sp.rootGapName && (
                        <p className="text-[11px] text-amber-400">
                          ↳ Diverted to Prerequisite Foundation:{' '}
                          <span className="font-semibold">{sp.rootGapName}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="border-t border-slate-800 pt-4 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setSelectedStudentForModal(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
              >
                Close Profile
              </button>
              <button
                type="button"
                onClick={() => {
                  alert(
                    `Targeted prerequisite review packet for [${selectedStudentForModal.name}] generated and queued!`
                  );
                }}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition"
              >
                Assign Targeted Remediation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
