import { useQuizStore, conceptName, CHAPTER } from './quizStore';

const GENERIC_REASONS = [
  'Calculation error',
  'Misunderstood formula',
  'Confused terms',
  'Guessed',
];

const QuizScreen = () => {
  const {
    view, quizLength, setQuizLength, startQuiz, currentQuestion, mainAnswered,
    selectedAnswer, selectedConfidence, selectAnswer, selectConfidence, submitAnswer,
    currentDifficulty, inDeepDive, deepDiveTarget, pendingLoop, submitWhy,
  } = useQuizStore();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {view === 'setup' && (
        <div className="max-w-2xl mx-auto p-8">
          <h1 className="text-3xl font-bold mb-2 text-center">{CHAPTER} Quiz</h1>
          <p className="text-center text-gray-500 mb-6">Class 10 Physics</p>

          <label className="block text-sm font-medium mb-2">Quiz length</label>
          <div className="flex gap-3 mb-8">
            {([5, 10, 15] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setQuizLength(n)}
                className={`flex-1 px-4 py-2 rounded border transition ${
                  quizLength === n
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                }`}
              >
                {n} Questions
              </button>
            ))}
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => startQuiz()}
              className="px-8 py-3 bg-green-600 text-white font-semibold rounded hover:bg-green-700"
            >
              Start Quiz
            </button>
          </div>
        </div>
      )}

      {view === 'quiz' && currentQuestion && (
        <div className="max-w-2xl mx-auto p-8">
          {inDeepDive && deepDiveTarget && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="font-semibold text-amber-800">Loop Breaker activated</h3>
              <p className="text-amber-700 text-sm mt-1">
                A few extra questions to fix the real gap:{' '}
                <strong>{conceptName(deepDiveTarget)}</strong>
              </p>
            </div>
          )}

          <h2 className="text-xl font-bold mb-1">
            {inDeepDive
              ? 'Extra practice'
              : `Question ${Math.min(mainAnswered + 1, quizLength)} of ${quizLength}`}
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            {conceptName(currentQuestion.concept_id)} · Difficulty: {currentDifficulty}
          </p>
          <p className="text-lg mb-4 text-gray-700">{currentQuestion.question_text}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {Object.entries(currentQuestion.options).map(([key, text]) => (
              <div
                key={key}
                onClick={() => selectAnswer(key)}
                className={`p-4 rounded shadow cursor-pointer transition ${
                  selectedAnswer === key
                    ? 'bg-blue-50 border-2 border-blue-500'
                    : 'bg-white border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <h3 className="font-bold mb-1">{key}</h3>
                <p className="text-gray-700">{text}</p>
              </div>
            ))}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">How sure are you?</label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => selectConfidence('sure')}
                className={`px-4 py-2 rounded transition ${
                  selectedConfidence === 'sure'
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                }`}
              >
                Sure
              </button>
              <button
                type="button"
                onClick={() => selectConfidence('not_sure')}
                className={`px-4 py-2 rounded transition ${
                  selectedConfidence === 'not_sure'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                Not sure
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={submitAnswer}
              disabled={!selectedAnswer || !selectedConfidence}
              className={`px-6 py-2 rounded font-medium ${
                !selectedAnswer || !selectedConfidence
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Submit
            </button>
            <span className="text-sm text-gray-500">
              {!selectedAnswer
                ? 'Select an answer'
                : !selectedConfidence
                ? 'Select Sure or Not sure'
                : 'Ready'}
            </span>
          </div>

          <div className="mt-8 h-2 bg-gray-200 rounded overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${Math.min(100, (mainAnswered / quizLength) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {view === 'why' && pendingLoop && currentQuestion && (
        <div className="max-w-2xl mx-auto p-8">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 mb-6">
            <h2 className="text-xl font-bold text-amber-800 mb-1">
              Let's find out what's going wrong
            </h2>
            <p className="text-amber-700 text-sm">
              You're stuck on <strong>{conceptName(pendingLoop.conceptId)}</strong>. Why did
              you choose that answer? (one tap)
            </p>
          </div>
          <div className="space-y-3">
            {[
              currentQuestion.misconceptions?.[pendingLoop.wrongOption],
              ...GENERIC_REASONS,
            ]
              .filter((r): r is string => !!r)
              .map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => submitWhy(reason)}
                  className="w-full text-left px-4 py-3 bg-white border border-gray-200 rounded hover:bg-blue-50 hover:border-blue-300 transition"
                >
                  {reason}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizScreen;