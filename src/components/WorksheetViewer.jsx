import React, { useState, useEffect, useCallback } from 'react';
import { doc, updateDoc } from 'firebase/firestore';

// --- Sub-component for displaying the Quiz ---
const QuizTaker = ({ assignment, worksheetData, db }) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [studentAnswers, setStudentAnswers] = useState(() => {
        if (assignment.studentWork && assignment.studentWork.answers) {
            return assignment.studentWork.answers;
        }
        return new Array(worksheetData.questions.length).fill(null);
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [quizFinished, setQuizFinished] = useState(assignment.status === 'Completed' || assignment.status === 'Handed In');

    // --- FIX: Add state to hold the final score for rendering ---
    const [finalScore, setFinalScore] = useState(null);

    const currentQuestion = worksheetData.questions[currentQuestionIndex];

    const handleAnswerSelect = (optionIndex) => {
        const newAnswers = [...studentAnswers];
        newAnswers[currentQuestionIndex] = optionIndex;
        setStudentAnswers(newAnswers);
    };

    const handleQuizSubmit = async () => {
        if (!window.confirm("Are you sure you want to submit your answers? You cannot change them after submitting.")) {
            return;
        }
        setIsSubmitting(true);
        
        let correctCount = 0;
        worksheetData.questions.forEach((q, index) => {
            if (q.correctAnswerIndex === studentAnswers[index]) {
                correctCount++;
            }
        });
        
        const score = `${correctCount} / ${worksheetData.questions.length}`;
        const finalAnswers = studentAnswers.map(ans => (typeof ans === 'number' ? ans : null));

        try {
            const assignmentRef = doc(db, "assignments", assignment.id);
            await updateDoc(assignmentRef, {
                status: 'Completed',
                mark: score,
                feedback: 'This quiz was automatically graded.',
                studentWork: {
                    answers: finalAnswers,
                    score: score,
                }
            });
            
            // --- FIX: Set the score in state before finishing ---
            setFinalScore(score);
            setQuizFinished(true);

        } catch (err) {
            console.error("Error submitting quiz:", err);
            alert("There was an error submitting your quiz. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (quizFinished) {
        // --- FIX: Use the state variable as a fallback for the score ---
        const scoreToShow = assignment.studentWork?.score || finalScore;
        const resultsToShow = assignment.studentWork?.answers || studentAnswers;

        return (
            <div className="p-8">
                <h3 className="text-2xl font-bold mb-4 text-center">Quiz Complete!</h3>
                <div className="bg-blue-100 text-blue-800 p-6 rounded-lg text-center">
                    <p className="text-lg">Your Score:</p>
                    <p className="text-4xl font-bold">{scoreToShow}</p>
                </div>
                <div className="mt-6">
                    <h4 className="font-semibold mb-2">Review Your Answers:</h4>
                    {worksheetData.questions.map((q, index) => (
                        <div key={index} className={`p-4 rounded-md mb-3 ${resultsToShow[index] === q.correctAnswerIndex ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border`}>
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
    
    return (
        <div className="p-8">
            <div className="mb-4 text-center">
                <h3 className="text-2xl font-bold">{worksheetData.title}</h3>
                <p className="text-sm text-gray-500">Question {currentQuestionIndex + 1} of {worksheetData.questions.length}</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-md">
                <p className="text-xl font-semibold mb-6">{currentQuestion.questionText}</p>
                <div className="space-y-3">
                    {currentQuestion.options.map((option, index) => (
                        <label key={index} className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                            <input
                                type="radio"
                                name={`question-${currentQuestionIndex}`}
                                checked={studentAnswers[currentQuestionIndex] === index}
                                onChange={() => handleAnswerSelect(index)}
                                className="h-5 w-5 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-4 text-gray-700">{option}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="flex justify-between mt-8">
                <button 
                    onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                    disabled={currentQuestionIndex === 0}
                    className="px-6 py-2 bg-gray-300 text-gray-800 rounded-md disabled:opacity-50"
                >
                    Previous
                </button>
                {currentQuestionIndex < worksheetData.questions.length - 1 ? (
                    <button 
                        onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                        className="px-6 py-2 bg-blue-600 text-white rounded-md"
                    >
                        Next
                    </button>
                ) : (
                    <button
                        onClick={handleQuizSubmit}
                        disabled={isSubmitting}
                        className="px-6 py-2 bg-green-600 text-white rounded-md disabled:bg-green-400"
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
                    </button>
                )}
            </div>
        </div>
    );
};


function WorksheetViewer({ assignment, db, navigateTo, returnRoute = 'dashboard' }) {
  const [iframeSrcDoc, setIframeSrcDoc] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const worksheetData = assignment.worksheet;

  const processHtmlWorksheet = useCallback(async () => {
    if (!worksheetData || !worksheetData.worksheetURL || !worksheetData.fileMap) {
      setError('Invalid worksheet data provided.');
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(worksheetData.worksheetURL);
      if (!response.ok) throw new Error(`Failed to fetch main HTML: ${response.statusText}`);
      let htmlContent = await response.text();

      htmlContent = htmlContent.replace(/ (src|href)="([^"]+)"/g, (match, attr, value) => {
        if (!/^(https?:)?\/\//.test(value)) {
          const fileName = value.split('/').pop();
          if (worksheetData.fileMap[fileName]) {
            return ` ${attr}="${worksheetData.fileMap[fileName]}"`;
          }
        }
        return match;
      });

      if (assignment.studentWork) {
        const scriptToInject = `
          <script>
            window.MGS_HUB_SAVED_STATE = ${JSON.stringify(assignment.studentWork)};
            window.MGS_HUB_VIEW_MODE = ${JSON.stringify(assignment.status === 'Handed In' || assignment.status === 'Completed' ? 'student-submitted' : 'student-editing')};
          <\/script>
        `;
        htmlContent = htmlContent.replace('</head>', `${scriptToInject}</head>`);
      }
      setIframeSrcDoc(htmlContent);
    } catch (err) {
      console.error("Error processing worksheet:", err);
      setError("Could not load the worksheet content.");
    } finally {
      setLoading(false);
    }
  }, [worksheetData, assignment]);

  useEffect(() => {
    if (!worksheetData) {
        setLoading(true);
        return;
    }
    
    if (worksheetData.type === 'quiz') {
      setLoading(false);
    } else {
      processHtmlWorksheet();
    }
  }, [worksheetData, processHtmlWorksheet]);

  if (loading) {
    return <div className="flex items-center justify-center h-full"><p>Loading worksheet...</p></div>;
  }
  
  if (error) {
    return <div className="flex items-center justify-center h-full"><p className="text-red-500">{error}</p></div>;
  }

  return (
    <div className="bg-gray-100 min-h-screen">
       <header className="bg-white shadow-sm p-4">
         <button onClick={() => navigateTo(returnRoute)} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">
          &larr; Back to Dashboard
        </button>
      </header>

      <main className="container mx-auto p-4 md:p-8">
        {worksheetData.type === 'quiz' ? (
          <QuizTaker assignment={assignment} worksheetData={worksheetData} db={db} />
        ) : (
          <div className="border rounded-lg overflow-hidden bg-white" style={{ height: '85vh' }}>
            <iframe
                srcDoc={iframeSrcDoc}
                title={worksheetData.title}
                width="100%"
                height="100%"
                style={{ border: 'none' }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default WorksheetViewer;