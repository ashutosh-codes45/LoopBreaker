import React from 'react';
import { ConceptState, ConceptGraphItem } from './types';
import { ReportResult } from './engine';

interface SessionData {
  studentId: string;
  chapterName: string;
  totalMainQuestions: number;
  totalLoopBreakerQuestions: number;
  report: ReportResult;
  conceptGraph: ConceptGraphItem[];
}

interface ReportDashboardProps {
  sessionData: SessionData;
  onRetakeConcept: (conceptId: string, conceptName: string, prerequisite: string | null) => void;
  onBackToSetup: () => void;
}

const ReportDashboard: React.FC<ReportDashboardProps> = ({ 
  sessionData, 
  onRetakeConcept, 
  onBackToSetup 
}) => {
  const {
    studentId,
    chapterName,
    totalMainQuestions,
    totalLoopBreakerQuestions,
    report,
    conceptGraph
  } = sessionData;

  // Calculate total questions answered (main quiz + loop breaker remediation)
  const totalQuestionsAnswered = totalMainQuestions + totalLoopBreakerQuestions;
  
  // Early Estimate Flag: under 10 main questions indicates small sample size
  const earlyEstimate = totalMainQuestions < 10;

  // Build a map from concept ID to display name for quick lookup
  const conceptNameMap = new Map<string, string>();
     conceptGraph.forEach(item => conceptNameMap.set(item.id, item.name));

  // Helper to get concept display name
  const getConceptName = (conceptId: string): string => {
    return conceptNameMap.get(conceptId) || conceptId;
  };

  // Separate concepts by status
  interface ConceptStateWithId extends ConceptState {
    concept: string;
  }

  const understoodStates: ConceptStateWithId[] = [];
  const shakyStates: ConceptStateWithId[] = [];
  const weakStates: ConceptStateWithId[] = [];

  report.conceptBreakdown.forEach((state, conceptId) => {
    const stateWithId: ConceptStateWithId = { ...state, concept: conceptId };
    switch (state.status) {
      case 'understood':
        understoodStates.push(stateWithId);
        break;
      case 'shaky':
        shakyStates.push(stateWithId);
        break;
      case 'weak':
        weakStates.push(stateWithId);
        break;
    }
  });

  // Sort concepts by priority: misconceptions first, then by mastery level
    const sortByPriority = <T extends ConceptState>(states: T[]): T[] => {
    const isMisconceptionPriority = report.priority === 'misconception';
    return states.sort((a, b) => {
      // Misconception priority first
      if (isMisconceptionPriority) {
        // Concepts with sure_wrong_count > 0 are misconception-focused
        const aHasMisconception = a.sure_wrong_count > 0 || a.wrong_streak >= 2;
        const bHasMisconception = b.sure_wrong_count > 0 || b.wrong_streak >= 2;
        if (aHasMisconception !== bHasMisconception) return bHasMisconception ? 1 : -1;
      }
      // Then sort by p_mastery descending (lower mastery = higher priority)
      return b.p_mastery - a.p_mastery;
    });
  };

  const sortedUnderstood = sortByPriority(understoodStates);
  const sortedShaky = sortByPriority(shakyStates);
  const sortedWeak = sortByPriority(weakStates);

  // Get the first loop breaker question's concept for misconception reasons
  let misconceptionReasons = [
    { label: 'Calculation error', value: 'Calculation error' },
    { label: 'Misunderstood formula', value: 'Misunderstood formula' },
    { label: 'Confused terms', value: 'Confused terms' },
    { label: 'Other', value: 'Other' }
  ];

  if (totalLoopBreakerQuestions > 0 && report.retake.length > 0) {
    const firstRetake = report.retake[0];
    const firstConceptId = firstRetake.concept;
    const firstConceptName = getConceptName(firstConceptId);
    // Try to find misconception data from the concept graph question associations
    // For now use generic reasons
    misconceptionReasons = [
      { label: 'Calculation error', value: 'Calculation error' },
      { label: 'Misunderstood formula', value: 'Misunderstood formula' },
      { label: 'Confused terms', value: 'Confused terms' },
      { label: 'Other', value: 'Other' }
    ];
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <div className="max-w-5xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-center mb-4 text-gray-900">
            Electricity Breakdown
          </h1>
          <div className="flex justify-between items-center mb-6">
            <div className="text-xl font-medium text-gray-700">
              Total Questions Answered: {totalQuestionsAnswered}
            </div>
            {earlyEstimate && (
  <span className="inline-block bg-amber-200 text-amber-900 px-2 py-1 rounded text-sm">
    Early estimate: fewer than 10 main questions
  </span>
)}
          </div>
          
          {/* Concept Breakdown */}
          <div className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Concept Breakdown</h2>
            
            {/* Understood (Green) */}
            <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-md">
              <h3 className="text-lg font-semibold text-green-800 mb-3">
                Understood (Green) 
                <span className="text-green-600 ml-1">({sortedUnderstood.length})</span>
              </h3>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                {sortedUnderstood.map((state) => {
                  const name = getConceptName(state.concept);
                  return (
                    <li key={state.concept} className="flex justify-between">
                      <span className="flex-1">{name}</span>
                      <span className="text-green-500">{state.p_mastery.toFixed(1)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            
            {/* Shaky (Yellow) */}
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
              <h3 className="text-lg font-semibold text-yellow-800 mb-3">
                Shaky (Yellow) 
                <span className="text-yellow-600 ml-1">({sortedShaky.length})</span>
              </h3>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                {sortedShaky.map((state) => {
                  const name = getConceptName(state.concept);
                  return (
                    <li key={state.concept} className="flex justify-between">
                      <span className="flex-1">{name}</span>
                      <span className="text-yellow-500">{state.p_mastery.toFixed(1)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            
            {/* Weak (Red) */}
            <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
              <h3 className="text-lg font-semibold text-red-800 mb-3">
                Weak (Red) 
                <span className="text-red-600 ml-1">({sortedWeak.length})</span>
              </h3>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                {sortedWeak.map((state) => {
                  const name = getConceptName(state.concept);
                  return (
                    <li key={state.concept} className="flex justify-between">
                      <span className="flex-1">{name}</span>
                      <span className="text-red-500">{state.p_mastery.toFixed(1)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
          
          {/* Actionable Retake Panel */}
          <div className="bg-gray-50 border-l-4 border-gray-400 p-4 rounded-md">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Your Remediation Roadmap</h2>
            {report.retake.length > 0 ? (
              <ul className="space-y-3">
                {report.retake.map((item, index) => {
                  const conceptName = getConceptName(item.concept);
                  const prerequisiteName = item.prerequisite 
                    ? getConceptName(item.prerequisite) 
                    : 'No prerequisite';
                  return (
                    <li key={index} className="flex flex-col sm:flex-row p-3 bg-gray-100 rounded-md">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800 mb-1">
                          Retake: <strong className="text-gray-700">{conceptName}</strong>
                        </p>
                        <p className="text-xs text-gray-600">
                          Prerequisite: <span className="text-gray-500">{prerequisiteName}</span>, 
                          {chapterName}
                        </p>
                      </div>
                      <button
                        onClick={() => onRetakeConcept(item.concept, conceptName, item.prerequisite)}
                        className="mt-2 sm:mt-0 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        Start Micro-Quiz
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-gray-600 text-sm">No remediation needed - all concepts mastered!</p>
            )}
            
            <div className="mt-4">
              <button
                onClick={onBackToSetup}
                className="mt-2 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
              >
                Back to Quiz Setup
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportDashboard;