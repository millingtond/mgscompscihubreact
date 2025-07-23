import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const TOPICS_BY_YEAR = {
  'GCSE': [
    { value: '1.1', label: '1.1 Systems Architecture' },
    { value: '1.2', label: '1.2 Memory and Storage' },
    { value: '1.3', label: '1.3 Computer Networks, Connections and Protocols' },
    { value: '1.4', label: '1.4 Network Security' },
    { value: '1.5', label: '1.5 System Software' },
    { value: '1.6', label: '1.6 Ethical, Legal, Cultural and Environmental Concerns' },
    { value: '2.1', label: '2.1 Algorithms' },
    { value: '2.2', label: '2.2 Programming Fundamentals' },
    { value: '2.3', label: '2.3 Producing Robust Programs' },
    { value: '2.4', label: '2.4 Boolean Logic' },
    { value: '2.5', label: '2.5 Programming Languages and Integrated Development Environments' },
    { value: 'other', label: 'Other' },
  ],
  'A-Level': [{ value: 'other', label: 'Other' }],
  'Year 9': [{ value: 'other', label: 'Other' }],
  'Year 8': [{ value: 'other', label: 'Other' }],
  'Year 7': [{ value: 'other', label: 'Other' }],
  'Other': [{ value: 'other', label: 'Other' }],
};

const YEAR_GROUPS = ['Year 7', 'Year 8', 'Year 9', 'GCSE', 'A-Level', 'Other'];

// --- Quiz Editing Modal Component ---
const QuizEditModal = ({ quiz, onSave, onCancel, db }) => {
    const [editingQuiz, setEditingQuiz] = useState(JSON.parse(JSON.stringify(quiz))); // Deep copy
    const [isSaving, setIsSaving] = useState(false);

    const handleQuestionTextChange = (e, qIndex) => {
        const newQuestions = [...editingQuiz.questions];
        newQuestions[qIndex].questionText = e.target.value;
        setEditingQuiz({ ...editingQuiz, questions: newQuestions });
    };

    const handleOptionChange = (e, qIndex, oIndex) => {
        const newQuestions = [...editingQuiz.questions];
        newQuestions[qIndex].options[oIndex] = e.target.value;
        setEditingQuiz({ ...editingQuiz, questions: newQuestions });
    };
    
    const handleCorrectAnswerChange = (qIndex, oIndex) => {
        const newQuestions = [...editingQuiz.questions];
        newQuestions[qIndex].correctAnswerIndex = oIndex;
        setEditingQuiz({ ...editingQuiz, questions: newQuestions });
    };

    const handleAddQuestion = () => {
        const newQuestion = {
            questionText: 'New Question',
            options: ['Option 1', 'Option 2'],
            correctAnswerIndex: 0
        };
        setEditingQuiz({ ...editingQuiz, questions: [...editingQuiz.questions, newQuestion] });
    };

    const handleDeleteQuestion = (qIndex) => {
        if (window.confirm('Are you sure you want to delete this question?')) {
            const newQuestions = editingQuiz.questions.filter((_, index) => index !== qIndex);
            setEditingQuiz({ ...editingQuiz, questions: newQuestions });
        }
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        try {
            const worksheetRef = doc(db, "worksheets", editingQuiz.id);
            await updateDoc(worksheetRef, {
                questions: editingQuiz.questions
            });
            onSave(editingQuiz);
        } catch (err) {
            console.error("Error saving quiz changes:", err);
            alert("Failed to save changes.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[90vh] flex flex-col">
                <h3 className="text-xl font-bold mb-4">Editing Quiz: {editingQuiz.title}</h3>
                <div className="overflow-y-auto flex-grow pr-2 space-y-4">
                    {editingQuiz.questions.map((q, qIndex) => (
                        <div key={qIndex} className="bg-gray-50 p-4 rounded-md border">
                            <label className="block text-sm font-bold text-gray-700">Question {qIndex + 1}</label>
                            <textarea value={q.questionText} onChange={(e) => handleQuestionTextChange(e, qIndex)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" rows="2" />
                            <div className="mt-2 space-y-2">
                                {q.options.map((opt, oIndex) => (
                                    <div key={oIndex} className="flex items-center gap-2">
                                        <input type="radio" name={`correct_q_${qIndex}`} checked={q.correctAnswerIndex === oIndex} onChange={() => handleCorrectAnswerChange(qIndex, oIndex)} />
                                        <input type="text" value={opt} onChange={(e) => handleOptionChange(e, qIndex, oIndex)} className="flex-grow p-2 border border-gray-300 rounded-md" />
                                    </div>
                                ))}
                            </div>
                             <button onClick={() => handleDeleteQuestion(qIndex)} className="text-red-500 hover:underline text-xs mt-3">Delete Question</button>
                        </div>
                    ))}
                    <button onClick={handleAddQuestion} className="w-full text-sm bg-gray-200 hover:bg-gray-300 py-2 rounded-md">+ Add Question</button>
                </div>
                <div className="flex justify-end space-x-4 mt-6 pt-4 border-t">
                    <button onClick={onCancel} className="bg-gray-300 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-400">Cancel</button>
                    <button onClick={handleSaveChanges} disabled={isSaving} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-400">
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

function ManageWorksheets({ db, storage }) {
  const [worksheets, setWorksheets] = useState([]);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const [selectedYear, setSelectedYear] = useState('');
  const [availableTopics, setAvailableTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState('');

  const [editingTitleId, setEditingTitleId] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  
  const [creationMode, setCreationMode] = useState('worksheet');
  const [quizFile, setQuizFile] = useState(null);
  
  const [quizInputMode, setQuizInputMode] = useState('file');
  const [quizText, setQuizText] = useState('');

  const [editingQuiz, setEditingQuiz] = useState(null);

  useEffect(() => {
    const fetchWorksheets = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "worksheets"));
        const worksheetsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setWorksheets(worksheetsList.sort((a, b) => a.title.localeCompare(b.title)));
      } catch (err) {
        console.error("Error fetching worksheets: ", err);
        setError('Failed to load worksheets.');
      }
    };
    fetchWorksheets();
  }, [db]);

  const resetForm = () => {
      setTitle('');
      setSelectedYear('');
      setSelectedTopic('');
      setAvailableTopics([]);
      setFile(null);
      setQuizFile(null);
      setQuizText('');
      setError('');
      if (document.getElementById('file-input')) {
        document.getElementById('file-input').value = '';
      }
      if (document.getElementById('quiz-file-input')) {
        document.getElementById('quiz-file-input').value = '';
      }
  };

  const handleYearChange = (e) => {
    const year = e.target.value;
    setSelectedYear(year);
    setAvailableTopics(TOPICS_BY_YEAR[year] || []);
    setSelectedTopic('');
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };
  
  const handleQuizFileChange = (e) => {
    setQuizFile(e.target.files[0]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !title || !selectedYear || !selectedTopic) {
      setError('Please fill in all fields and select a file.');
      return;
    }
    setUploading(true);
    setError('');

    try {
      const fileRef = ref(storage, `worksheets/${Date.now()}-${file.name}`);
      const snapshot = await uploadBytes(fileRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      const docRef = await addDoc(collection(db, "worksheets"), {
        title: title,
        yearGroup: selectedYear,
        topic: selectedTopic,
        url: downloadURL,
        fileName: file.name,
        type: 'html'
      });

      setWorksheets(prev => [...prev, { id: docRef.id, title, yearGroup: selectedYear, topic: selectedTopic, url: downloadURL, fileName: file.name, type: 'html' }].sort((a, b) => a.title.localeCompare(b.title)));
      resetForm();

    } catch (err) {
      console.error("Error uploading worksheet: ", err);
      setError('File upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const parseAndCreateQuiz = async (text) => {
    try {
        const questionBlocks = text.split('[START Q]').slice(1);
        if (questionBlocks.length === 0) {
            throw new Error("No questions found. Make sure your text contains blocks starting with [START Q].");
        }
        const parsedQuestions = questionBlocks.map((block, index) => {
            const questionData = { questionText: '', options: [], correctAnswerIndex: null };
            const lines = block.split('\n').filter(line => line.trim() !== '');
            
            const questionLine = lines.find(line => line.trim().startsWith('Question:'));
            if (!questionLine) throw new Error(`Question ${index + 1} is missing a "Question:" line.`);
            questionData.questionText = questionLine.replace('Question:', '').trim();

            questionData.options = lines.filter(line => line.trim().startsWith('O:')).map(opt => opt.replace('O:', '').trim());
            if (questionData.options.length < 2) throw new Error(`Question ${index + 1} must have at least two options starting with "O:".`);

            const answerLine = lines.find(line => line.trim().startsWith('A:'));
            if (!answerLine) throw new Error(`Question ${index + 1} is missing an "A:" line for the answer index.`);
            const answerIndex = parseInt(answerLine.replace('A:', '').trim(), 10);
            if (isNaN(answerIndex) || answerIndex < 0 || answerIndex >= questionData.options.length) {
                throw new Error(`The answer index for Question ${index + 1} is invalid or out of bounds.`);
            }
            questionData.correctAnswerIndex = answerIndex;

            return questionData;
        });

        const newQuiz = {
            title,
            yearGroup: selectedYear,
            topic: selectedTopic,
            questions: parsedQuestions,
            type: 'quiz',
            createdAt: new Date(),
        };
        const docRef = await addDoc(collection(db, "worksheets"), newQuiz);
        setWorksheets(prev => [...prev, { id: docRef.id, ...newQuiz }].sort((a,b) => a.title.localeCompare(b.title)));
        resetForm();

    } catch (err) {
        console.error("Error parsing or uploading quiz:", err);
        throw err;
    }
  };

  const handleCreateQuiz = async (e) => {
    e.preventDefault();
    if (!title || !selectedYear || !selectedTopic) {
        setError('Please fill in the Title, Year Group, and Topic fields.');
        return;
    }
    
    setUploading(true);
    setError('');

    try {
        if (quizInputMode === 'file') {
            if (!quizFile) {
                throw new Error('Please select a template file to upload.');
            }
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    await parseAndCreateQuiz(event.target.result);
                } catch(err) {
                    setError(`Error: ${err.message}`);
                } finally {
                    setUploading(false);
                }
            };
            reader.readAsText(quizFile);
        } else {
            if (!quizText.trim()) {
                throw new Error('Please paste the quiz text into the text box.');
            }
            await parseAndCreateQuiz(quizText);
            setUploading(false);
        }
    } catch(err) {
        setError(`Error: ${err.message}`);
        setUploading(false);
    }
  };
  
  const handleDownloadTemplate = () => {
    const templateContent = `// INSTRUCTIONS
// - Each question block must start with [START Q] on a new line.
// - The question text must start with "Question: ".
// - Each multiple-choice option must start with "O: " on a new line.
// - The correct answer must be specified with "A: " followed by the index of the correct option (starting from 0).
// - Do not include [END Q] markers, the parser handles this automatically.

[START Q]
Question: What does CPU stand for?
O: Central Processing Unit
O: Computer Personal Unit
O: Central Power Unit
O: Central Process Unit
A: 0

[START Q]
Question: Which of these is an example of volatile memory?
O: SSD
O: HDD
O: RAM
O: ROM
A: 2
`;
    const blob = new Blob([templateContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Quiz_Template.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (worksheet) => {
    if (!window.confirm(`Are you sure you want to delete "${worksheet.title}"?`)) {
        return;
    }
    try {
        await deleteDoc(doc(db, "worksheets", worksheet.id));
        if (worksheet.type === 'html' && worksheet.fileName) {
            const fileRef = ref(storage, `worksheets/${worksheet.fileName}`);
            await deleteObject(fileRef);
        }
        setWorksheets(prev => prev.filter(w => w.id !== worksheet.id));
    } catch (err) {
        console.error("Error deleting worksheet:", err);
        setError(`Failed to delete worksheet. It may have already been removed.`);
    }
  };

  const handleStartTitleEdit = (worksheet) => {
    setEditingTitleId(worksheet.id);
    setNewTitle(worksheet.title);
  };

  const handleCancelTitleEdit = () => {
    setEditingTitleId(null);
    setNewTitle('');
  };

  const handleSaveTitle = async (worksheetId) => {
    if (!newTitle.trim()) {
      setError("Title cannot be empty.");
      return;
    }
    try {
      const worksheetRef = doc(db, "worksheets", worksheetId);
      await updateDoc(worksheetRef, {
        title: newTitle
      });
      setWorksheets(prev => prev.map(ws => 
        ws.id === worksheetId ? { ...ws, title: newTitle } : ws
      ));
      handleCancelTitleEdit();
    } catch (err) {
      console.error("Error updating title:", err);
      setError("Failed to update worksheet title.");
    }
  };

  const handleStartQuizEdit = (quiz) => {
      setEditingQuiz(quiz);
  };
  
  const handleCancelQuizEdit = () => {
      setEditingQuiz(null);
  };

  const handleSaveQuiz = (updatedQuiz) => {
      setWorksheets(prev => prev.map(ws => ws.id === updatedQuiz.id ? updatedQuiz : ws));
      setEditingQuiz(null);
  };

  return (
    <div className="p-8">
      {editingQuiz && <QuizEditModal quiz={editingQuiz} onSave={handleSaveQuiz} onCancel={handleCancelQuizEdit} db={db} />}

      <h2 className="text-3xl font-bold mb-6">Manage Learning Materials</h2>
        
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <div className="flex border-b mb-4">
            <button onClick={() => { setCreationMode('worksheet'); resetForm(); }} className={`py-2 px-4 font-semibold ${creationMode === 'worksheet' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>Upload Worksheet</button>
            <button onClick={() => { setCreationMode('quiz'); resetForm(); }} className={`py-2 px-4 font-semibold ${creationMode === 'quiz' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>Create Quiz</button>
        </div>

        {error && <p className="text-red-500 bg-red-100 p-3 rounded-md mb-4">{error}</p>}
        
        <form onSubmit={creationMode === 'worksheet' ? handleUpload : handleCreateQuiz}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700">Title</label>
                    <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" placeholder="e.g., Binary Logic Practice"/>
                </div>
                <div>
                    <label htmlFor="year-group" className="block text-sm font-medium text-gray-700">Year Group</label>
                    <select id="year-group" value={selectedYear} onChange={handleYearChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md bg-white">
                        <option value="" disabled>Select a year group...</option>
                        {YEAR_GROUPS.map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="topic" className="block text-sm font-medium text-gray-700">Topic</label>
                    <select id="topic" value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md bg-white disabled:bg-gray-100" disabled={!selectedYear || availableTopics.length === 0}>
                        <option value="" disabled>{selectedYear ? 'Select a topic...' : 'Select a year group first'}</option>
                        {availableTopics.map(topic => <option key={topic.value} value={topic.value}>{topic.label}</option>)}
                    </select>
                </div>
            </div>

            {creationMode === 'worksheet' && (
                <div>
                    <label htmlFor="file-input" className="block text-sm font-medium text-gray-700">Worksheet File</label>
                    <input type="file" id="file-input" onChange={handleFileChange} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                </div>
            )}

            {creationMode === 'quiz' && (
                <div className="mt-4 pt-4 border-t">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Quiz Content</label>
                    <div className="flex items-center gap-4 mb-3">
                        <button type="button" onClick={handleDownloadTemplate} className="text-sm bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700">Download Template</button>
                        <div className="flex-grow text-right">
                            <span className="text-sm mr-2">Input Method:</span>
                            <button type="button" onClick={() => setQuizInputMode('file')} className={`text-sm px-3 py-1 rounded-l-md ${quizInputMode === 'file' ? 'bg-purple-600 text-white' : 'bg-gray-200'}`}>File Upload</button>
                            <button type="button" onClick={() => setQuizInputMode('text')} className={`text-sm px-3 py-1 rounded-r-md ${quizInputMode === 'text' ? 'bg-purple-600 text-white' : 'bg-gray-200'}`}>Paste Text</button>
                        </div>
                    </div>
                    
                    {quizInputMode === 'file' ? (
                        <div>
                            <label htmlFor="quiz-file-input" className="block text-sm font-medium text-gray-700 sr-only">Upload Completed Template</label>
                            <input type="file" id="quiz-file-input" onChange={handleQuizFileChange} accept=".txt" className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"/>
                        </div>
                    ) : (
                        <div>
                             <label htmlFor="quiz-text-input" className="block text-sm font-medium text-gray-700 sr-only">Paste Quiz Text</label>
                             <textarea 
                                id="quiz-text-input"
                                value={quizText}
                                onChange={(e) => setQuizText(e.target.value)}
                                rows="10"
                                className="mt-1 block w-full p-2 border border-gray-300 rounded-md font-mono text-sm"
                                placeholder="Paste your formatted quiz text here..."
                             ></textarea>
                        </div>
                    )}
                </div>
            )}
             <div className="mt-6">
                <button type="submit" disabled={uploading} className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-400">
                    {uploading ? 'Processing...' : (creationMode === 'quiz' ? 'Create Quiz' : 'Upload Worksheet')}
                </button>
            </div>
        </form>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-4">Existing Materials</h3>
        <div className="space-y-3">
          {worksheets.length > 0 ? (
            worksheets.map(ws => (
              <div key={ws.id} className="bg-white p-4 rounded-lg shadow-sm flex justify-between items-center">
                {editingTitleId === ws.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="flex-1 p-2 border border-blue-500 rounded-md"/>
                    <button onClick={() => handleSaveTitle(ws.id)} className="text-sm bg-green-500 text-white px-3 py-2 rounded-md hover:bg-green-600">Save</button>
                    <button onClick={handleCancelTitleEdit} className="text-sm bg-gray-200 px-3 py-2 rounded-md hover:bg-gray-300">Cancel</button>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="font-semibold">{ws.title}
                        {ws.type === 'quiz' && <span className="ml-2 text-xs font-semibold bg-purple-100 text-purple-800 px-2 py-1 rounded-full">Quiz</span>}
                      </p>
                      <p className="text-sm text-gray-500">{ws.yearGroup} - Topic {ws.topic}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      {ws.type === 'html' && <a href={ws.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">View</a>}
                      <button onClick={() => {
                          if (ws.type === 'quiz') {
                              handleStartQuizEdit(ws);
                          } else {
                              handleStartTitleEdit(ws);
                          }
                      }} className="text-yellow-600 hover:underline text-sm font-semibold">Edit</button>
                      <button onClick={() => handleDelete(ws)} className="text-red-600 hover:underline text-sm">Delete</button>
                    </div>
                  </>
                )}
              </div>
            ))
          ) : (
            <p className="text-gray-500">No materials have been created yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ManageWorksheets;