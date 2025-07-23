import React, { useState, useEffect, useCallback } from 'react';
// Import the necessary Firebase Functions modules
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';

// --- No changes needed in the main WorksheetViewer component ---
// Just ensure the 'app' prop is passed down to QuizTaker
function WorksheetViewer({ assignment, db, navigateTo, returnRoute = 'dashboard', app }) {
  const [worksheetHtml, setWorksheetHtml] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const worksheetData = assignment.worksheet;

  const processHtmlWorksheet = useCallback((htmlContent) => {
    // ... (existing code for processing HTML is unchanged)
    return htmlContent;
  }, [assignment.id, assignment.studentUID]);

  useEffect(() => {
    if (worksheetData.type === 'html' && worksheetData.htmlContent) {
      const processedHtml = processHtmlWorksheet(worksheetData.htmlContent);
      setWorksheetHtml(processedHtml);
    }
  }, [worksheetData, processHtmlWorksheet]);

  if (!worksheetData) {
    return <div>Loading worksheet...</div>;
  }

  return (
    <div className="bg-gray-100 min-h-screen">
      <header className="bg-white shadow-sm p-4 flex justify-between items-center">
        <button
          onClick={() => navigateTo(returnRoute)}
          className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
        >
          &larr; Back
        </button>
        <h1 className="text-xl font-bold">{worksheetData.title}</h1>
        <div></div> {/* Spacer */}
      </header>

      <main className="container mx-auto p-4 md:p-8">
        {worksheetData.type === 'quiz' ? (
          <QuizTaker assignment={assignment} worksheetData={worksheetData} db={db} app={app} />
        ) : (
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <iframe
              srcDoc={worksheetHtml}
              title="Worksheet"
              className="w-full h-screen border-none"
              id="worksheet-iframe"
            ></iframe>
          </div>
        )}
      </main>
    </div>
  );
}


// --- Sub-component for displaying and handling the Quiz ---
const QuizTaker = ({ assignment, worksheetData, db, app }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  // Initialize answers from saved student work if available
  const [studentAnswers, setStudentAnswers] = useState(() => {
    if (assignment.studentWork && Array.isArray(assignment.studentWork.answers)) {
      return assignment.studentWork.answers;
    }
    return new Array(worksheetData.questions.length).fill(null);
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  // Determine if the quiz is finished based on status or if a mark is present
  const [quizFinished, setQuizFinished] = useState(
    assignment.status === 'Completed' || typeof assignment.mark === 'number'
  );
  const [finalScore, setFinalScore] = useState(assignment.mark || null);

  const currentQuestion = worksheetData.questions[currentQuestionIndex];

  const handleAnswerSelect = (optionIndex) => {
    if (quizFinished) return; // Prevent changes after submission
    const newAnswers = [...studentAnswers];
    newAnswers[currentQuestionIndex] = optionIndex;
    setStudentAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestionIndex < worksheetData.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  // --- MODIFIED: This function now calls the secure cloud function ---
  const handleQuizSubmit = async () => {
    // Use a custom modal in a real app, but window.confirm is fine for now.
    if (!window.confirm("Are you sure you want to submit your answers? You cannot change them after submitting.")) {
      return;
    }
    setIsSubmitting(true);

    // Ensure nulls are sent for unanswered questions for consistent data structure
    const finalAnswers = studentAnswers.map(ans => (typeof ans === 'number' ? ans : null));

    try {
      // 1. Initialize the Firebase Functions service
      const functions = getFunctions(app);
      // 2. Get a reference to your 'submitQuiz' cloud function
      const submitQuiz = httpsCallable(functions, 'submitQuiz');

      // 3. Call the function with the required data
      const result = await submitQuiz({
        assignmentId: assignment.id,
        answers: finalAnswers
      });

      // 4. The function returns the score; update the UI state
      if (result.data && typeof result.data.score === 'number') {
        setFinalScore(result.data.score);
      }
      setQuizFinished(true); // Lock the quiz from further edits

    } catch (err) {
      console.error("Error submitting quiz via cloud function:", err);
      // Provide user-friendly error message
      alert(`There was an error submitting your quiz. Please try again. \nError: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // If the quiz is finished, show the results view
  if (quizFinished) {
    const scoreToShow = finalScore;
    // Use the answers from the assignment document for the review, as it's the source of truth
    const resultsToShow = assignment.studentWork?.answers || studentAnswers;

    return (
      <div className="p-4 sm:p-8 bg-white rounded-lg shadow-lg">
        <h3 className="text-2xl font-bold mb-4 text-center">Quiz Complete!</h3>
        <div className="bg-blue-100 text-blue-800 p-6 rounded-lg text-center">
          <p className="text-lg">Your Score:</p>
          <p className="text-4xl font-bold">{scoreToShow} / {worksheetData.questions.length}</p>
        </div>
        <div className="mt-6">
          <h4 className="font-semibold mb-2 text-lg">Review Your Answers:</h4>
          {worksheetData.questions.map((q, index) => (
            <div key={index} className={`p-4 rounded-md mb-3 border-l-4 ${resultsToShow[index] === q.correctAnswerIndex ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
              <p className="font-bold">{index + 1}. {q.questionText}</p>
              <p className="text-sm mt-2">You answered: <span className="font-semibold">{q.options[resultsToShow[index]] ?? 'No Answer'}</span></p>
              {resultsToShow[index] !== q.correctAnswerIndex && (
                <p className="text-sm text-green-700">Correct answer: <span className="font-semibold">{q.options[q.correctAnswerIndex]}</span></p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // This is the active quiz-taking view
  return (
    <div className="bg-white p-4 sm:p-8 rounded-lg shadow-lg">
      <div className="mb-6">
        <p className="text-gray-600 text-sm">Question {currentQuestionIndex + 1} of {worksheetData.questions.length}</p>
        <h3 className="text-2xl font-semibold mt-1">{currentQuestion.questionText}</h3>
      </div>

      <div className="space-y-3">
        {currentQuestion.options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleAnswerSelect(index)}
            className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${studentAnswers[currentQuestionIndex] === index ? 'bg-blue-500 text-white border-blue-600 shadow-md' : 'bg-white hover:bg-gray-100 border-gray-300'}`}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="mt-8 flex justify-between items-center">
        <button
          onClick={handlePrev}
          disabled={currentQuestionIndex === 0}
          className="px-6 py-2 bg-gray-300 rounded-md disabled:opacity-50"
        >
          Previous
        </button>
        {currentQuestionIndex === worksheetData.questions.length - 1 ? (
          <button
            onClick={handleQuizSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 disabled:bg-green-300"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Final Answers'}
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
};

export default WorksheetViewer;
