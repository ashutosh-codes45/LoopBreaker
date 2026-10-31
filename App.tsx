import { useState } from 'react';
import QuizScreen from './QuizScreen';
import ReportDashboard from './ReportDashboard';
import TeacherDashboard, {
  MOCK_SIMULATED_STUDENTS,
  SimulatedStudent,
} from './TeacherDashboard';
import { useQuizStore, conceptGraph, conceptName, CHAPTER } from './quizStore';

function buildLiveStudent(
  states: ReturnType<typeof useQuizStore.getState>['studentStates'],
  struggles: ReturnType<typeof useQuizStore.getState>['strugglePoints'],
  attempts: number
): SimulatedStudent | null {
  const entries = Object.entries(states);
  if (entries.length === 0) return null;
  const conceptStates = entries.map(([key, st]) => {
    const cid = key.slice(key.indexOf(':') + 1);
    return {
      conceptId: cid,
      conceptName: conceptName(cid),
      prerequisites: conceptGraph.find((c) => c.id === cid)?.prerequisites ?? [],
      p_mastery: st.p_mastery,
      status: st.status,
      attempts: st.attempts,
      wrong_streak: st.wrong_streak,
      clean_streak: st.clean_streak,
      sure_wrong_count: st.sure_wrong_count,
    };
  });
  const avg = conceptStates.reduce((a, c) => a + c.p_mastery, 0) / conceptStates.length;
  return {
    id: 'student-1',
    name: 'You (live demo)',
    avatarBg: 'bg-indigo-600',
    overallScore: Math.round(avg * 100),
    completionDate: new Date().toLocaleString(),
    totalAttempts: attempts,
    conceptStates,
    struggle_points: struggles.map((sp) => ({
      id: sp.id,
      conceptId: sp.conceptId,
      conceptName: conceptName(sp.conceptId),
      rootGapConcept: sp.rootGapConcept,
      rootGapName: sp.rootGapConcept ? conceptName(sp.rootGapConcept) : null,
      reason: sp.reason,
      timestamp: new Date(sp.timestamp).toLocaleTimeString(),
      timeSpentSeconds: 0,
      loopBreakerTriggered: true,
    })),
    isStuckInLoop: struggles.length >= 3,
    hasPrerequisiteGap: struggles.some((s) => s.rootGapConcept),
    notes: 'Live student from this session',
  };
}

export default function App() {
  const [tab, setTab] = useState<'student' | 'teacher'>('student');
  const store = useQuizStore();

  const live = buildLiveStudent(
    store.studentStates,
    store.strugglePoints,
    store.mainAnswered + store.deepAnswered
  );
  const students = live ? [live, ...MOCK_SIMULATED_STUDENTS] : MOCK_SIMULATED_STUDENTS;

  return (
    <div>
      <nav className="flex gap-2 p-3 bg-white border-b border-gray-200 sticky top-0 z-40">
        <span className="font-bold mr-4 self-center">Unstuck</span>
        {(['student', 'teacher'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded text-sm font-medium ${
              tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t === 'student' ? 'Student' : 'Teacher dashboard'}
          </button>
        ))}
      </nav>

      {tab === 'teacher' ? (
        <TeacherDashboard students={students} />
      ) : store.view === 'report' ? (
        <ReportDashboard
          sessionData={{
            studentId: 'student-1',
            chapterName: CHAPTER,
            totalMainQuestions: store.mainAnswered,
            totalLoopBreakerQuestions: store.deepAnswered,
            report: store.getReportData(),
            conceptGraph,
          }}
          onRetakeConcept={(id, _name, prereq) =>
            store.startQuiz([id, ...(prereq ? [prereq] : [])])
          }
          onBackToSetup={store.resetQuiz}
        />
      ) : (
        <QuizScreen />
      )}
    </div>
  );
}