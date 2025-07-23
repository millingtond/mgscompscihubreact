import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';

const GRADES = {
  O: 'Outstanding',
  E: 'Excellent',
  G: 'Good',
  RI: 'Requires Improvement',
  U: 'Unsatisfactory',
};

// --- Sub-component for displaying the quiz review ---
const QuizReview = ({ assignment, worksheet }) => {
    return (
        <div className="p-6">
            <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-800 p-6 rounded-lg mb-6 text-center">
                <h3 className="text-xl font-bold">Quiz Results</h3>
                <p className="text-4xl font-extrabold mt-2">{assignment.mark}</p>
            </div>
            <h4 className="text-lg font-semibold mb-4">Student's Answers:</h4>
            <div className="space-y-4">
                {worksheet.questions.map((q, index) => {
                    const studentAnswerIndex = assignment.studentWork?.answers?.[index];
                    const isCorrect = studentAnswerIndex === q.correctAnswerIndex;

                    return (
                        <div key={index} className={`p-4 rounded-lg border-l-4 ${isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
                            <p className="font-bold">{index + 1}. {q.questionText}</p>
                            <div className="mt-3 text-sm">
                                <p>Correct Answer: <span className="font-semibold">{q.options[q.correctAnswerIndex]}</span></p>
                                <p>Student's Answer: <span className="font-semibold">{studentAnswerIndex !== null && studentAnswerIndex !== undefined ? q.options[studentAnswerIndex] : 'Not answered'}</span></p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


function MarkingView({ assignment, classData, db, navigateTo }) {
  const [classAssignments, setClassAssignments] = useState([]);
  const [currentAssignmentIndex, setCurrentAssignmentIndex] = useState(0);
  
  const [worksheet, setWorksheet] = useState(null);

  const [rawWorksheetHtml, setRawWorksheetHtml] = useState('');
  const [iframeSrcDoc, setIframeSrcDoc] = useState('');
  const [feedback, setFeedback] = useState('');
  const [grade, setGrade] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processMessage, setProcessMessage] = useState('');

  const currentAssignment = classAssignments[currentAssignmentIndex];

  useEffect(() => {
    const fetchClassAssignments = async () => {
        if (!classData || !assignment) return;
        try {
            const q = query(collection(db, "assignments"), where("classId", "==", classData.id), where("worksheetId", "==", assignment.worksheetId));
            const assignmentsSnapshot = await getDocs(q);
            
            const assignmentsList = await Promise.all(assignmentsSnapshot.docs.map(async (assignDoc) => {
                const assignmentData = assignDoc.data();
                const studentQuery = query(collection(db, "students"), where("studentUID", "==", assignmentData.studentUID));
                const [studentSnap] = await Promise.all([getDocs(studentQuery)]);
                const studentUsername = !studentSnap.empty ? studentSnap.docs[0].data().username : 'Unknown Student';
                return { id: assignDoc.id, ...assignmentData, username: studentUsername };
            }));
            
            setClassAssignments(assignmentsList);
            const initialIndex = assignmentsList.findIndex(a => a.id === assignment.id);
            setCurrentAssignmentIndex(initialIndex >= 0 ? initialIndex : 0);

            const worksheetRef = doc(db, "worksheets", assignment.worksheetId);
            const worksheetSnap = await getDoc(worksheetRef);
            if (worksheetSnap.exists()) {
                setWorksheet({ id: worksheetSnap.id, ...worksheetSnap.data() });
            } else {
                throw new Error("Worksheet document not found.");
            }

        } catch (err) {
            console.error("Error fetching class assignments or worksheet:", err);
            setError("Could not load all assignments for this class.");
        }
    };

    fetchClassAssignments();
  }, [assignment, classData, db]);

  useEffect(() => {
    if (!currentAssignment || !worksheet) return;

    const processWorksheet = async () => {
      setLoading(true);
      setError('');

      try {
        if (worksheet.type === 'quiz') {
            setFeedback(currentAssignment.feedback || '');
            setGrade(currentAssignment.mark || '');
            setLoading(false);
            return;
        }

        if (!worksheet.worksheetURL || !worksheet.fileMap) throw new Error("Worksheet data is incomplete for an HTML worksheet.");

        const response = await fetch(worksheet.worksheetURL);
        if (!response.ok) throw new Error(`Failed to fetch main HTML: ${response.statusText}`);
        let htmlContent = await response.text();
        setRawWorksheetHtml(htmlContent);

        htmlContent = htmlContent.replace(/ (src|href)="([^"]+)"/g, (match, attr, value) => {
          if (!/^(https?:)?\/\//.test(value)) {
            const fileName = value.split('/').pop();
            if (worksheet.fileMap[fileName]) {
              return ` ${attr}="${worksheet.fileMap[fileName]}"`;
            }
          }
          return match;
        });
        
        const scriptToInject = `
          <script>
            window.MGS_HUB_SAVED_STATE = ${JSON.stringify(currentAssignment.studentWork || {})};
            window.MGS_HUB_VIEW_MODE = 'teacher';
          <\/script>
        `;
        const displayHtml = htmlContent.replace('</head>', `${scriptToInject}</head>`);
        
        setIframeSrcDoc(displayHtml);
        setFeedback(currentAssignment.feedback || '');
        setGrade(currentAssignment.mark || '');

      } catch (err) {
        console.error("Error processing worksheet:", err);
        setError("Could not load the worksheet content.");
      } finally {
        setLoading(false);
      }
    };

    processWorksheet();
  }, [currentAssignment, worksheet]);

  const handleSave = async () => { /* ... same as before ... */ };

  // --- FULLY RESTORED FUNCTION ---
  const handleExportAllAnswers = async () => {
    if (classAssignments.length === 0) {
      alert("No assignments to export.");
      return;
    }
    
    if (!rawWorksheetHtml) {
        alert("Worksheet content is not available yet. Please wait a moment and try again.");
        return;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(rawWorksheetHtml, 'text/html');

    let exportContent = `Worksheet: ${worksheet.title}\nClass: ${classData.className}\n\n`;

    classAssignments.forEach(assign => {
      exportContent += "========================================\n";
      exportContent += `[START STUDENT]\n`;
      exportContent += `Student: ${assign.username}\n`;
      exportContent += `Assignment ID: ${assign.id}\n`;
      exportContent += "---\n";

      const studentWork = assign.studentWork || {};
      const studentAnswers = studentWork.inputs || studentWork;
      
      const questionContainers = doc.querySelectorAll('div.task-container, div[id^="Question"]');
      let answersFoundForStudent = false;

      if (questionContainers.length > 0) {
        questionContainers.forEach(container => {
          const textarea = container.querySelector('textarea');
          if (!textarea) return;

          const questionId = textarea.id;
          const studentAnswer = studentAnswers[questionId];

          if (studentAnswer != null && String(studentAnswer).trim() !== '') {
            answersFoundForStudent = true;
            
            const h4 = container.querySelector('h4');
            const pElements = Array.from(container.querySelectorAll('p'));
            const markSchemeDiv = container.querySelector('.mark-scheme');
            
            let markSchemeText = 'Mark scheme not found.';
            if (markSchemeDiv) {
                markSchemeText = markSchemeDiv.textContent.trim().replace(/^Mark Scheme:\s*/, '');
            }
            
            let textParts = [];
            if (h4) textParts.push(h4.textContent.trim());

            const questionParagraphs = pElements.filter(p => !markSchemeDiv || !markSchemeDiv.contains(p));
            textParts.push(...questionParagraphs.map(p => p.textContent.trim()));
            
            const questionText = textParts.length > 0 ? textParts.join('\n') : 'Question text not found.';

            exportContent += `Question ID: ${questionId}\n`;
            exportContent += `Question: ${questionText}\n`;
            exportContent += `Mark Scheme: ${markSchemeText}\n`;
            exportContent += `Answer: ${studentAnswer}\n\n`;
          }
        });
      }
      
      if (!answersFoundForStudent) {
          exportContent += "No written answers submitted.\n\n";
      }

      exportContent += `[END STUDENT]\n\n`;
    });

    const blob = new Blob([exportContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${classData.className.replace(/\s/g, '_')}-${worksheet.title.replace(/\s/g, '_')}_Answers.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- FULLY RESTORED FUNCTION ---
  const handleDownloadTemplate = () => {
    if (classAssignments.length === 0) {
      alert("No assignments to create a template for.");
      return;
    }

    let templateContent = `Worksheet: ${worksheet.title}\nClass: ${classData.className}\n\n`;

    classAssignments.forEach(assign => {
      templateContent += "========================================\n";
      templateContent += `[START STUDENT]\n`;
      templateContent += `Student: ${assign.username}\n`;
      templateContent += `Assignment ID: ${assign.id}\n`;
      templateContent += "---\n";
      templateContent += `Grade: \n`;
      templateContent += `Feedback:\n`;
      templateContent += `[END STUDENT]\n\n`;
    });

    const blob = new Blob([templateContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${classData.className.replace(/\s/g, '_')}-${worksheet.title.replace(/\s/g, '_')}_Feedback_Template.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- FULLY RESTORED FUNCTION ---
  const handleImportFeedback = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target.result;
      setIsProcessing(true);
      setProcessMessage("Processing file...");

      try {
        const batch = writeBatch(db);
        let updatedCount = 0;

        const studentBlocks = content.split('[START STUDENT]');
        studentBlocks.forEach(block => {
          if (block.trim() === '') return;

          const assignmentIdMatch = block.match(/Assignment ID: ([\w-]+)/);
          const gradeMatch = block.match(/Grade: (\w+)/);
          const feedbackMatch = block.match(/Feedback:\n([\s\S]*?)(?=\[END STUDENT\])/);

          if (assignmentIdMatch && gradeMatch && feedbackMatch) {
            const assignmentId = assignmentIdMatch[1].trim();
            const grade = gradeMatch[1].trim();
            const feedback = feedbackMatch[1].trim();

            if (grade && feedback) {
              const assignmentRef = doc(db, "assignments", assignmentId);
              batch.update(assignmentRef, {
                mark: grade,
                feedback: feedback,
                status: 'Completed'
              });
              updatedCount++;
            }
          }
        });

        if (updatedCount > 0) {
          await batch.commit();
          setProcessMessage(`${updatedCount} assignments updated successfully! The changes will be visible next time you view the class.`);
        } else {
          setProcessMessage("No valid feedback blocks found or fields were empty. Please check the file format and try again.");
        }
      } catch (err) {
        console.error("Error importing feedback:", err);
        setProcessMessage("An error occurred during import. Please check the file format and try again.");
      } finally {
        setIsProcessing(false);
        event.target.value = null;
      }
    };
    reader.readAsText(file);
  };

  const navigateStudent = (direction) => { /* ... same as before ... */ };

  if (!currentAssignment || !worksheet) {
    return <div className="p-8 text-center">Loading assignment details...</div>;
  }
  
  if (error) {
     return <div className="p-8 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b bg-white">
          <h2 className="text-xl font-bold">Marking: {worksheet.title}</h2>
          <p className="text-sm text-gray-600">Student: <span className="font-semibold">{currentAssignment.username}</span></p>
        </div>
        <div className="flex-1 bg-white shadow-md m-4 rounded-lg overflow-y-auto">
          {loading ? (
            <p className="p-4">Loading Worksheet...</p>
          ) : (
            worksheet.type === 'quiz' ? (
                <QuizReview assignment={currentAssignment} worksheet={worksheet} />
            ) : (
                <iframe
                    srcDoc={iframeSrcDoc}
                    title="Worksheet"
                    className="w-full h-full border-0"
                    sandbox="allow-scripts allow-same-origin allow-forms"
                />
            )
          )}
        </div>
      </div>

      <div className="w-96 bg-white p-6 shadow-lg overflow-y-auto">
        <button onClick={() => navigateTo('student-work', classData, { studentUID: assignment.studentUID, username: currentAssignment.username })} className="mb-6 w-full bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">
          &larr; Back to Student Assignments
        </button>
        
        <div className="mb-6 border p-3 rounded-md">
            {/* Student Navigation... */}
        </div>

        {worksheet.type !== 'quiz' && (
             <div className="mb-6 border p-3 rounded-md bg-gray-50">
                <h4 className="text-md font-semibold text-gray-800 mb-3">Bulk Feedback</h4>
                <p className="text-xs text-gray-600 mb-3">Export answers for analysis or download a template to fill in.</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                    <button onClick={handleExportAllAnswers} className="w-full text-sm bg-gray-600 text-white px-3 py-2 rounded-md hover:bg-gray-700">
                    Export Answers
                    </button>
                    <button onClick={handleDownloadTemplate} className="w-full text-sm bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700">
                    Download Template
                    </button>
                </div>
                <input type="file" id="feedback-upload" className="hidden" accept=".txt" onChange={handleImportFeedback} />
                <button onClick={() => document.getElementById('feedback-upload').click()} disabled={isProcessing} className="w-full text-sm bg-purple-600 text-white px-3 py-2 rounded-md hover:bg-purple-700 disabled:bg-purple-400">
                    {isProcessing ? 'Processing...' : 'Import Feedback File'}
                </button>
                {processMessage && <p className="text-xs text-center mt-2 text-gray-600">{processMessage}</p>}
            </div>
        )}

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Manual Grade</label>
           <input
                type="text"
                id="grade"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                placeholder="e.g., 8/10 or O"
            />
        </div>

        <div className="mb-6">
          <label htmlFor="feedback" className="block text-sm font-medium text-gray-700">Feedback</label>
          <textarea id="feedback" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows="6" className="mt-1 block w-full p-2 border border-gray-300 rounded-md"></textarea>
        </div>

        <button onClick={handleSave} disabled={isSaving} className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-green-400">
          {isSaving ? 'Saving...' : 'Save Mark & Feedback'}
        </button>
      </div>
    </div>
  );
}

export default MarkingView;