import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
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

// --- Reusable Confirmation Modal Component ---
const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel' }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h3 className="text-lg font-bold mb-4">{title}</h3>
                <p className="text-sm text-gray-600 mb-6">{message}</p>
                <div className="flex justify-end space-x-4">
                    <button onClick={onCancel} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">
                        {cancelText}
                    </button>
                    <button onClick={onConfirm} className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700">
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- Quiz Editing Modal Component ---
const QuizEditModal = ({ quiz, onSave, onCancel, db, storage }) => {
    const [editingQuiz, setEditingQuiz] = useState(JSON.parse(JSON.stringify(quiz)));
    const [isSaving, setIsSaving] = useState(false);
    const [isConfirmDeleteQuestionOpen, setConfirmDeleteQuestionOpen] = useState(false);
    const [questionIndexToDelete, setQuestionIndexToDelete] = useState(null);

    const handleQuestionUpdate = (qIndex, field, value) => {
        const newQuestions = [...editingQuiz.questions];
        newQuestions[qIndex][field] = value;
        setEditingQuiz({ ...editingQuiz, questions: newQuestions });
    };

    const handleOptionChange = (qIndex, oIndex, value) => {
        const newQuestions = [...editingQuiz.questions];
        newQuestions[qIndex].options[oIndex] = value;
        setEditingQuiz({ ...editingQuiz, questions: newQuestions });
    };

    const handleQuestionTypeChange = (qIndex, newType) => {
        const newQuestions = [...editingQuiz.questions];
        const currentQuestion = newQuestions[qIndex];
        currentQuestion.type = newType;

        // Reset answer fields when type changes
        if (newType === 'multiple-choice') {
            currentQuestion.options = ['Option 1', 'Option 2', 'Option 3', 'Option 4'];
            currentQuestion.correctAnswerIndex = 0;
            delete currentQuestion.correctAnswer;
            delete currentQuestion.modelAnswer;
        } else if (newType === 'text-input') {
            currentQuestion.correctAnswer = '';
            delete currentQuestion.options;
            delete currentQuestion.correctAnswerIndex;
            delete currentQuestion.modelAnswer;
        } else if (newType === 'extended-text') {
            currentQuestion.modelAnswer = '';
            delete currentQuestion.options;
            delete currentQuestion.correctAnswerIndex;
            delete currentQuestion.correctAnswer;
        }
        setEditingQuiz({ ...editingQuiz, questions: newQuestions });
    };

    const handleAddQuestion = () => {
        const newQuestion = {
            type: 'multiple-choice',
            questionText: 'New Question',
            options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
            correctAnswerIndex: 0,
            imageUrl: null,
            altText: '',
            imageLayout: 'top'
        };
        setEditingQuiz({ ...editingQuiz, questions: [...editingQuiz.questions, newQuestion] });
    };

    const handleDeleteQuestionClick = (qIndex) => {
        setQuestionIndexToDelete(qIndex);
        setConfirmDeleteQuestionOpen(true);
    };

    const confirmDeleteQuestion = () => {
        const newQuestions = editingQuiz.questions.filter((_, index) => index !== questionIndexToDelete);
        setEditingQuiz({ ...editingQuiz, questions: newQuestions });
        setConfirmDeleteQuestionOpen(false);
        setQuestionIndexToDelete(null);
    };

    const handleImageUpload = async (e, qIndex) => {
        const file = e.target.files[0];
        if (!file) return;

        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            alert('Invalid file type. Please upload a JPG, PNG, or GIF.');
            return;
        }
        const maxSizeInMB = 2;
        if (file.size > maxSizeInMB * 1024 * 1024) {
            alert(`File is too large. Please upload an image smaller than ${maxSizeInMB}MB.`);
            return;
        }

        handleQuestionUpdate(qIndex, 'isUploadingImage', true);

        try {
            const imageRef = ref(storage, `worksheets/${quiz.id}/question_${qIndex}_${Date.now()}`);
            await uploadBytes(imageRef, file);
            const downloadURL = await getDownloadURL(imageRef);

            const newQuestions = [...editingQuiz.questions];
            newQuestions[qIndex].imageUrl = downloadURL;
            newQuestions[qIndex].isUploadingImage = false;
            setEditingQuiz({ ...editingQuiz, questions: newQuestions });

        } catch (err) {
            console.error("Error uploading image:", err);
            alert("Image upload failed.");
            handleQuestionUpdate(qIndex, 'isUploadingImage', false);
        }
    };

    const handleRemoveImage = async (qIndex) => {
        const question = editingQuiz.questions[qIndex];
        if (!question.imageUrl) return;

        try {
            const imageRef = ref(storage, question.imageUrl);
            await deleteObject(imageRef);
            
            const newQuestions = [...editingQuiz.questions];
            newQuestions[qIndex].imageUrl = null;
            newQuestions[qIndex].altText = '';
            setEditingQuiz({ ...editingQuiz, questions: newQuestions });

        } catch (err) {
            console.error("Error deleting image:", err);
            alert("Failed to remove image.");
        }
    };


    const handleSaveChanges = async () => {
        setIsSaving(true);
        const questionsToSave = editingQuiz.questions.map(({ isUploadingImage, ...rest }) => rest);

        try {
            const worksheetRef = doc(db, "worksheets", editingQuiz.id);
            await updateDoc(worksheetRef, {
                questions: questionsToSave
            });
            onSave({ ...editingQuiz, questions: questionsToSave });
        } catch (err) {
            console.error("Error saving quiz changes:", err);
            alert("Failed to save changes.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <ConfirmationModal
                isOpen={isConfirmDeleteQuestionOpen}
                title="Delete Question"
                message="Are you sure you want to permanently delete this question?"
                onConfirm={confirmDeleteQuestion}
                onCancel={() => setConfirmDeleteQuestionOpen(false)}
                confirmText="Delete"
            />
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-40">
                <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[90vh] flex flex-col">
                    <h3 className="text-xl font-bold mb-4">Editing Quiz: {editingQuiz.title}</h3>
                    <div className="overflow-y-auto flex-grow pr-2 space-y-4">
                        {editingQuiz.questions.map((q, qIndex) => (
                            <div key={qIndex} className="bg-gray-50 p-4 rounded-md border">
                                <div className="flex justify-between items-center mb-2">
                                    <select value={q.type || 'multiple-choice'} onChange={(e) => handleQuestionTypeChange(qIndex, e.target.value)} className="p-1 border border-gray-300 rounded-md text-sm">
                                        <option value="multiple-choice">Multiple Choice</option>
                                        <option value="text-input">Text Input</option>
                                        <option value="extended-text">Extended Text</option>
                                    </select>
                                    <button onClick={() => handleDeleteQuestionClick(qIndex)} className="text-red-500 hover:underline text-xs">Delete Question</button>
                                </div>
                                <textarea value={q.questionText} onChange={(e) => handleQuestionUpdate(qIndex, 'questionText', e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" rows="2" placeholder="Enter question text here..."/>
                                
                                {/* Answer section based on question type */}
                                {q.type === 'multiple-choice' || !q.type ? (
                                    <div className="mt-2 space-y-2">
                                        {q.options.map((opt, oIndex) => (
                                            <div key={oIndex} className="flex items-center gap-2">
                                                <input type="radio" name={`correct_q_${qIndex}`} checked={q.correctAnswerIndex === oIndex} onChange={() => handleQuestionUpdate(qIndex, 'correctAnswerIndex', oIndex)} />
                                                <input type="text" value={opt} onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)} className="flex-grow p-2 border border-gray-300 rounded-md" />
                                            </div>
                                        ))}
                                    </div>
                                ) : q.type === 'text-input' ? (
                                    <div className="mt-2">
                                        <label className="text-sm font-medium">Correct Answer:</label>
                                        <input type="text" value={q.correctAnswer || ''} onChange={(e) => handleQuestionUpdate(qIndex, 'correctAnswer', e.target.value)} className="mt-1 w-full p-2 border border-gray-300 rounded-md" />
                                    </div>
                                ) : (
                                    <div className="mt-2">
                                        <label className="text-sm font-medium">Model Answer (for teacher reference):</label>
                                        <textarea value={q.modelAnswer || ''} onChange={(e) => handleQuestionUpdate(qIndex, 'modelAnswer', e.target.value)} className="mt-1 w-full p-2 border border-gray-300 rounded-md" rows="3"></textarea>
                                    </div>
                                )}
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
        </>
    );
};


function ManageWorksheets({ db, storage }) {
  const [worksheets, setWorksheets] = useState([]);
  const [title, setTitle] = useState('');
  const [files, setFiles] = useState([]);
  const [mainHtmlFile, setMainHtmlFile] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');

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

  const [filterYear, setFilterYear] = useState('');
  const [filterTopic, setFilterTopic] = useState('');
  const [filterTopicsList, setFilterTopicsList] = useState([]);
  const [sortBy, setSortBy] = useState('title');
  const [searchTerm, setSearchTerm] = useState('');

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);

  const [isConfirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [worksheetToDelete, setWorksheetToDelete] = useState(null);

  useEffect(() => {
    const fetchWorksheets = async () => {
      if (!db) return;
      try {
        const querySnapshot = await getDocs(collection(db, "worksheets"));
        const worksheetsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setWorksheets(worksheetsList);
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
      setFiles([]);
      setMainHtmlFile('');
      setQuizFile(null);
      setQuizText('');
      setError('');
      setUploadProgress(0);
      setUploadMessage('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      const quizFileInput = document.getElementById('quiz-file-input');
      if (quizFileInput) quizFileInput.value = '';
  };

  const handleYearChange = (e) => {
    const year = e.target.value;
    setSelectedYear(year);
    setAvailableTopics(TOPICS_BY_YEAR[year] || []);
    setSelectedTopic('');
  };

  const parseFilenameForMetadata = (filename) => {
    const baseName = filename.replace(/\.(html|htm|txt)$/i, '');
    const searchString = baseName.replace(/[-_]/g, ' ');
    let foundYear = '';
    let foundTopic = '';

    const unitLessonRegex = /(U\d+[-_]?L\d+)|(U\d+)|(L\d+)/i;
    const match = baseName.match(unitLessonRegex);
    
    let generatedTitle = baseName;
    if (match) {
        const lessonName = baseName.replace(match[0], '').replace(/^[_-]/, '').trim();
        generatedTitle = `${match[0].toUpperCase()}-${lessonName}`;
    }
    setTitle(generatedTitle);

    for (const year of YEAR_GROUPS) {
        if (searchString.toLowerCase().includes(year.toLowerCase())) {
            foundYear = year;
            break;
        }
    }

    if (foundYear && TOPICS_BY_YEAR[foundYear]) {
        for (const topic of TOPICS_BY_YEAR[foundYear]) {
            if (searchString.includes(topic.value)) {
                foundTopic = topic.value;
                break;
            }
        }
    }
    
    if (foundYear) {
        setSelectedYear(foundYear);
        setAvailableTopics(TOPICS_BY_YEAR[foundYear] || []);
        if (foundTopic) {
            setSelectedTopic(foundTopic);
        }
    }
  };

  const processSelectedFiles = (selectedFiles) => {
    const filesArray = Array.from(selectedFiles);
    setFiles(filesArray);
    const firstHtml = filesArray.find(f => f.name.endsWith('.html') || f.name.endsWith('.htm'));
    if (firstHtml) {
        setMainHtmlFile(firstHtml.name);
        parseFilenameForMetadata(firstHtml.name);
    } else {
        setMainHtmlFile('');
    }
  };

  const handleFileChange = (e) => {
    processSelectedFiles(e.target.files);
  };
  
  const handleQuizFileChange = (e) => {
    const file = e.target.files[0];
    setQuizFile(file);
    if (file) {
        parseFilenameForMetadata(file.name);
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
        setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processSelectedFiles(e.dataTransfer.files);
        e.dataTransfer.clearData();
    }
  };


  const handleUpload = async (e) => {
    e.preventDefault();
    if (files.length === 0 || !title || !selectedYear || !selectedTopic) {
      setError('Please fill in all fields and select one or more files.');
      return;
    }
    if (!mainHtmlFile) {
      setError('Please select a main HTML file to serve as the entry point.');
      return;
    }
    setUploading(true);
    setError('');
    setUploadProgress(0);
    setUploadMessage('Initializing upload...');

    const worksheetRef = doc(collection(db, "worksheets"));
    const worksheetId = worksheetRef.id;
    const storageFolder = `worksheets/${worksheetId}`;

    try {
        const publicUrls = new Map();
        const dependentFiles = files.filter(f => f.name !== mainHtmlFile);
        const mainFileObject = files.find(f => f.name === mainHtmlFile);
        const totalSteps = dependentFiles.length + 2;
        let currentStep = 0;

        for (const file of dependentFiles) {
            currentStep++;
            setUploadMessage(`Uploading file ${currentStep} of ${files.length}: ${file.name}`);
            const fileRef = ref(storage, `${storageFolder}/${file.name}`);
            await uploadBytes(fileRef, file);
            const url = await getDownloadURL(fileRef);
            publicUrls.set(file.name, url);
            setUploadProgress((currentStep / totalSteps) * 100);
        }

        setUploadMessage('Processing main HTML file...');
        let mainHtmlContent = await mainFileObject.text();

        const linkRegex = /(href|src)=["'](?!https?:\/\/)(.*?)["']/g;
        mainHtmlContent = mainHtmlContent.replace(linkRegex, (match, attr, relativePath) => {
            const fileName = relativePath.split('/').pop();
            if (publicUrls.has(fileName)) {
                return `${attr}="${publicUrls.get(fileName)}"`;
            }
            return match;
        });

        currentStep++;
        setUploadMessage(`Uploading main file: ${mainHtmlFile}`);
        const modifiedHtmlBlob = new Blob([mainHtmlContent], { type: 'text/html' });
        const mainFileStorageRef = ref(storage, `${storageFolder}/${mainHtmlFile}`);
        await uploadBytes(mainFileStorageRef, modifiedHtmlBlob);
        const mainFileUrl = await getDownloadURL(mainFileStorageRef);
        setUploadProgress((currentStep / totalSteps) * 100);

        currentStep++;
        setUploadMessage('Saving to database...');
        const newWorksheetData = {
            title: title,
            yearGroup: selectedYear,
            topic: selectedTopic,
            url: mainFileUrl,
            type: 'html',
            filePaths: files.map(f => f.name),
            createdAt: new Date(),
        };
        await setDoc(worksheetRef, newWorksheetData);
        setUploadProgress(100);
        setUploadMessage('Upload complete!');

        setWorksheets(prev => [...prev, { id: worksheetId, ...newWorksheetData }]);
        
        setTimeout(() => {
            resetForm();
            setUploading(false);
        }, 2000);

    } catch (err) {
        console.error("Error uploading worksheet: ", err);
        setError('File upload failed. Please try again.');
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
            const questionData = { 
                type: 'multiple-choice', // Default type
                questionText: '', 
                imageUrl: null, 
                altText: '', 
                imageLayout: 'top' 
            };
            const lines = block.split('\n').filter(line => line.trim() !== '');
            
            lines.forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('[TYPE]:')) {
                    questionData.type = trimmedLine.replace('[TYPE]:', '').trim();
                } else if (trimmedLine.startsWith('Question:')) {
                    questionData.questionText = trimmedLine.replace('Question:', '').trim();
                } else if (trimmedLine.startsWith('O:')) {
                    if (!questionData.options) questionData.options = [];
                    questionData.options.push(trimmedLine.replace('O:', '').trim());
                } else if (trimmedLine.startsWith('A:')) {
                    if (questionData.type === 'multiple-choice') {
                        questionData.correctAnswerIndex = parseInt(trimmedLine.replace('A:', '').trim(), 10);
                    } else {
                        questionData.correctAnswer = trimmedLine.replace('A:', '').trim();
                    }
                }
            });

            // Validation
            if (!questionData.questionText) throw new Error(`Question ${index + 1} is missing a "Question:" line.`);
            if (questionData.type === 'multiple-choice' && (!questionData.options || questionData.options.length < 2)) {
                throw new Error(`Multiple choice Question ${index + 1} must have at least two options.`);
            }
            if (questionData.type === 'multiple-choice' && typeof questionData.correctAnswerIndex !== 'number') {
                 throw new Error(`Multiple choice Question ${index + 1} is missing a valid "A:" line for the answer index.`);
            }
             if (questionData.type === 'text-input' && typeof questionData.correctAnswer !== 'string') {
                 throw new Error(`Text input Question ${index + 1} is missing a valid "A:" line for the answer.`);
            }

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
        setWorksheets(prev => [...prev, { id: docRef.id, ...newQuiz }]);
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
    const templateContent = `// --- AI PROMPT: DO NOT DELETE THIS SECTION ---
// You are an expert quiz creator for Computer Science students.
// Your task is to generate a quiz based on the flashcard content provided at the end of this file.
// You MUST adhere strictly to the following format for every question. Do not add any other text or formatting.
// Each question must have exactly 4 options.
// The incorrect options (distractors) should be plausible and relevant to the topic, not obviously wrong or easy to eliminate.
// Ensure that every piece of information from the flashcard content is assessed by at least one question.

// --- FORMAT INSTRUCTIONS ---
// - Each question block must start with [START Q] on a new line.
// - The question text must start with "Question: ".
// - Each multiple-choice option must start with "O: ".
// - The correct answer must be specified with "A: " followed by the index of the correct option (starting from 0).

// --- EXAMPLE ---
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

// --- PASTE YOUR FLASHCARD CONTENT BELOW THIS LINE ---

`;
    const blob = new Blob([templateContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'AI_Quiz_Template.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDeleteClick = (worksheet) => {
    setWorksheetToDelete(worksheet);
    setConfirmDeleteOpen(true);
  };

  const executeDelete = async () => {
    if (!worksheetToDelete) return;

    try {
        if (worksheetToDelete.type === 'quiz' && worksheetToDelete.questions) {
            const imageDeletePromises = worksheetToDelete.questions.map(q => {
                if (q.imageUrl) {
                    const imageRef = ref(storage, q.imageUrl);
                    return deleteObject(imageRef).catch(err => {
                         if (err.code !== 'storage/object-not-found') {
                            console.error("Could not delete quiz image:", err);
                         }
                    });
                }
                return Promise.resolve();
            });
            await Promise.all(imageDeletePromises);
        }

        if (worksheetToDelete.type === 'html' && worksheetToDelete.filePaths && worksheetToDelete.filePaths.length > 0) {
            const deletePromises = worksheetToDelete.filePaths.map(filePath => {
                const fileRef = ref(storage, `worksheets/${worksheetToDelete.id}/${filePath}`);
                return deleteObject(fileRef).catch(err => {
                    if (err.code !== 'storage/object-not-found') throw err;
                });
            });
            await Promise.all(deletePromises);
        }
        
        await deleteDoc(doc(db, "worksheets", worksheetToDelete.id));

        setWorksheets(prev => prev.filter(w => w.id !== worksheetToDelete.id));
        setError('');

    } catch (err) {
        console.error("Error deleting worksheet:", err);
        setError(`Failed to delete worksheet. Please refresh and try again.`);
    } finally {
        setConfirmDeleteOpen(false);
        setWorksheetToDelete(null);
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

  const filteredAndSortedWorksheets = useMemo(() => {
    let result = [...worksheets];

    if (searchTerm) {
        result = result.filter(ws => ws.title.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    if (filterYear) {
        result = result.filter(ws => ws.yearGroup === filterYear);
    }
    if (filterTopic) {
        result = result.filter(ws => ws.topic === filterTopic);
    }

    if (sortBy === 'title') {
        result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'newest') {
        result.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
    } else if (sortBy === 'oldest') {
        result.sort((a, b) => (a.createdAt?.toDate() || 0) - (b.createdAt?.toDate() || 0));
    }

    return result;
  }, [worksheets, filterYear, filterTopic, sortBy, searchTerm]);

  const handleFilterYearChange = (e) => {
      const year = e.target.value;
      setFilterYear(year);
      setFilterTopic('');
      if (year) {
          setFilterTopicsList(TOPICS_BY_YEAR[year] || []);
      } else {
          setFilterTopicsList([]);
      }
  };

  return (
    <div className="p-8">
      {editingQuiz && <QuizEditModal quiz={editingQuiz} onSave={handleSaveQuiz} onCancel={handleCancelQuizEdit} db={db} storage={storage} />}
      
      <ConfirmationModal
        isOpen={isConfirmDeleteOpen}
        title="Delete Material"
        message={`Are you sure you want to permanently delete "${worksheetToDelete?.title}"? This action cannot be undone.`}
        onConfirm={executeDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
        confirmText="Delete"
      />

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
                    <label className="block text-sm font-medium text-gray-700">Worksheet File(s)</label>
                    <div 
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        className={`mt-1 flex justify-center items-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md transition-colors duration-200 ${isDragging ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}
                    >
                        <div className="space-y-1 text-center">
                            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <div className="flex text-sm text-gray-600">
                                <label htmlFor="file-input" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                                    <span>Upload files</span>
                                    <input ref={fileInputRef} id="file-input" name="file-input" type="file" multiple className="sr-only" onChange={handleFileChange} />
                                </label>
                                <p className="pl-1">or drag and drop</p>
                            </div>
                            <p className="text-xs text-gray-500">HTML, CSS, JS, images, etc.</p>
                        </div>
                    </div>
                    
                    {files.length > 0 && (
                        <div className="mt-4 p-3 bg-gray-50 rounded-md">
                            <p className="font-semibold text-sm text-gray-800">Select the main HTML file:</p>
                            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                                {files.filter(f => f.name.endsWith('.html') || f.name.endsWith('.htm')).map(file => (
                                    <div key={file.name} className="flex items-center">
                                        <input 
                                            type="radio" 
                                            id={`main-file-${file.name}`} 
                                            name="main-html-file" 
                                            value={file.name}
                                            checked={mainHtmlFile === file.name}
                                            onChange={(e) => setMainHtmlFile(e.target.value)}
                                            className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                        />
                                        <label htmlFor={`main-file-${file.name}`} className="ml-2 block text-sm text-gray-900">{file.name}</label>
                                    </div>
                                ))}
                            </div>
                             <p className="text-xs text-gray-500 mt-2">Selected {files.length} file(s) total.</p>
                        </div>
                    )}
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
                {uploading && (
                    <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-1">{uploadMessage}</p>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div 
                                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                                style={{ width: `${uploadProgress}%` }}
                            ></div>
                        </div>
                    </div>
                )}
                <button type="submit" disabled={uploading} className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed">
                    {uploading ? 'Processing...' : (creationMode === 'quiz' ? 'Create Quiz' : 'Upload Worksheet')}
                </button>
            </div>
        </form>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-4">Existing Materials ({filteredAndSortedWorksheets.length})</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="md:col-span-3">
                <label htmlFor="search-input" className="block text-sm font-medium text-gray-700">Search by Title</label>
                <input 
                    type="text" 
                    id="search-input"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Type to search..."
                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                />
            </div>
            <div>
                <label htmlFor="filter-year" className="block text-sm font-medium text-gray-700">Filter by Year</label>
                <select id="filter-year" value={filterYear} onChange={handleFilterYearChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md bg-white">
                    <option value="">All Years</option>
                    {YEAR_GROUPS.map(year => <option key={year} value={year}>{year}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="filter-topic" className="block text-sm font-medium text-gray-700">Filter by Topic</label>
                <select id="filter-topic" value={filterTopic} onChange={(e) => setFilterTopic(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md bg-white" disabled={!filterYear}>
                    <option value="">All Topics</option>
                    {filterTopicsList.map(topic => <option key={topic.value} value={topic.value}>{topic.label}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="sort-by" className="block text-sm font-medium text-gray-700">Sort By</label>
                <select id="sort-by" value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md bg-white">
                    <option value="title">Title (A-Z)</option>
                    <option value="newest">Date (Newest First)</option>
                    <option value="oldest">Date (Oldest First)</option>
                </select>
            </div>
        </div>
        
        <div className="space-y-3">
          {filteredAndSortedWorksheets.length > 0 ? (
            filteredAndSortedWorksheets.map(ws => (
              <div key={ws.id} className="bg-white p-4 rounded-lg shadow-sm flex justify-between items-center">
                <div className="flex-grow flex justify-between items-center">
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
                            {ws.type === 'html' && <span className="ml-2 text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-1 rounded-full">HTML</span>}
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
                          <button onClick={() => handleDeleteClick(ws)} className="text-red-600 hover:underline text-sm">Delete</button>
                        </div>
                      </>
                    )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center py-4">No materials match the current filters.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ManageWorksheets;
