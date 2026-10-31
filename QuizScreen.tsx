import { useQuizStore } from './quizStore';
import { Question } from './types';

const QuizScreen = () => {
  const store = useQuizStore();
  const {
    view,
    chapter,
    quizLength,
    setQuizLength,
    setChapter,
    questions,
    currentQuestionIndex,
    totalQuestions,
    selectedAnswer,
    selectedConfidence,
    selectAnswer,
    selectConfidence,
    submitAnswer,
    isDeepDive,
    rootGap,
    currentDifficulty,
    resetQuiz,
  } = store;

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Setup View */}
      {view === 'setup' && (
        <div className="max-w-2xl mx-auto p-8">
          <h1 className="text-3xl font-bold mb-6 text-center">
            {chapter} Chapter Quiz
          </h1>
          
          <div className="mb-6">
            <label className="block text-sm font-medium mb-1">
              Select Quiz Length
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setQuizLength(5)}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
              >
                5 Questions
              </button>
              <button
                type="button"
                onClick={() => setQuizLength(10)}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
              >
                10 Questions
              </button>
              <button
                type="button"
                onClick={() => setQuizLength(15)}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
              >
                15 Questions
              </button>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-1">
              Select Chapter
            </label>
            <select
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="Electricity">Electricity</option>
              <option value="Optics">Optics</option>
              <option value="Waves">Waves</option>
            </select>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={store.startQuiz}
              className="px-8 py-3 bg-green-600 text-white font-semibold rounded hover:bg-green-700 transition duration-200"
            >
              Start Quiz
            </button>
          </div>
        </div>
      )}

      {/* Active Quiz View */}
      {view === 'quiz' && currentQuestion && (
        <div className="max-w-2xl mx-auto p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-4">
              Question {currentQuestionIndex + 1} of {totalQuestions}
            </h2>
            <p className="text-lg mb-4 text-gray-700">
              {currentQuestion.question_text}
            </p>
            
            {/* Options Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 mb-6">
              {['A', 'B', 'C', 'D'].map((option) => {
                const isSelected = selectedAnswer === option;
                return (
                  <div
                    key={option}
                    className={`p-4 rounded shadow transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border-2 border-blue-500 ring-2 ring-blue-500/20'
                        : 'bg-white border border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => selectAnswer(option)}
                  >
                    <h3 className="font-bold mb-2 text-gray-800">{option}</h3>
                    <p className="text-gray-700">
                      {currentQuestion.options[option]}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Confidence Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-1">
                Confidence Level
              </label>
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
                  Not Sure
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={submitAnswer}
                disabled={!selectedAnswer || !selectedConfidence}
                className={`px-6 py-2 rounded font-medium transition ${
                  !selectedAnswer || !selectedConfidence
                    ? 'bg-gray-300 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                Submit
              </button>
              <span className="text-sm text-gray-500">
                {selectedAnswer && selectedConfidence
                  ? 'Ready to submit'
                  : !selectedAnswer
                  ? 'Select an answer'
                  : 'Select confidence level'}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="mt-8">
              <div className="h-2 bg-gray-200 rounded overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{
                    width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1 text-right">
                Difficulty: {currentDifficulty}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Deep Dive Alert - Inline Banner */}
      {(view === 'quiz' || view === 'deepDive') && isDeepDive && rootGap && (
        <div className="fixed top-4 left-4 right-4 z-50 animate-slide-down">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 shadow-lg max-w-2xl mx-auto">
            <div className="flex items-start gap-3">
              <svg
                className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800">
                  LoopBreaker Activated
                </h3>
                <p className="text-amber-700 text-sm mt-1">
                  You're now working on prerequisite questions to strengthen your foundation.
                  Current focus: <strong>{rootGap}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {}}
                className="text-amber-600 hover:text-amber-800 font-medium text-sm"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizScreen;