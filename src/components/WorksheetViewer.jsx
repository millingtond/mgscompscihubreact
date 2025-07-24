import React, { useState, useEffect, useCallback } from 'react';
import { doc, updateDoc } from 'firebase/firestore';

// --- Helper Component (No changes needed) ---
const SaveStatusIndicator = ({ status }) => {
    const statusConfig = {
        saving: { message: 'Saving...', color: 'text-gray-500', icon: '⏳' },
        saved: { message: 'Progress Saved', color: 'text-green-600', icon: '✓' },
        error: { message: 'Save Failed', color: 'text-red-600', icon: '✗' },
        idle: { message: '', color: '', icon: '' },
    };
    const { message, color, icon } = statusConfig[status] || statusConfig.idle;
    if (status === 'idle') {
        return <div className="w-36 h-6" />;
    }
    return (
        <div className={`flex items-center justify-end transition-opacity duration-300 ${color}`}>
            <span className="mr-2">{icon}</span>
            <p className="text-sm font-medium">{message}</p>
        </div>
    );
};

// --- Main Component ---
function WorksheetViewer({ assignment, db, navigateTo, returnRoute = 'dashboard' }) {
    const [worksheetHtml, setWorksheetHtml] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [saveStatus, setSaveStatus] = useState('idle');

    useEffect(() => {
        if (!assignment?.worksheet?.url) {
            setError('Assigned worksheet data is missing or invalid.');
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError('');

        const prepareWorksheet = async () => {
            try {
                const response = await fetch(assignment.worksheet.url);
                if (!response.ok) throw new Error(`Failed to fetch worksheet: ${response.statusText}`);
                let htmlContent = await response.text();
                const savedState = assignment.studentWork || {};

                const scriptToInject = `
          <script>
            document.addEventListener('DOMContentLoaded', () => {
              let lastSavedState = ${JSON.stringify(savedState)};

              // --- STATE SAVING LOGIC ---
              function getWorksheetState() {
                  const state = {
                      inputs: {},
                      interactiveStates: {}
                  };
                  // 1. Save 'savable' text/number inputs
                  document.querySelectorAll('textarea.savable, input.savable').forEach(el => {
                      if (el.id) state.inputs[el.id] = el.value;
                  });
                  // 2. Save Starter Match-Up
                  const matchingTask = document.getElementById('matching-task');
                  if (matchingTask) {
                      const matchedIds = [];
                      matchingTask.querySelectorAll('.match-item.matched').forEach(item => {
                          matchedIds.push(item.dataset.match);
                      });
                      state.interactiveStates['matching-task'] = { matched: Array.from(new Set(matchedIds)) };
                  }
                  // 3. Save Fill-in-the-Blanks
                  const blanksTask = document.getElementById('blanks-task');
                  if (blanksTask) {
                      const filledBlanks = {};
                      blanksTask.querySelectorAll('.blank-space').forEach(blank => {
                          if (blank.textContent.trim()) {
                              filledBlanks[blank.dataset.answer] = blank.textContent;
                          }
                      });
                      state.interactiveStates['blanks-task'] = { filledBlanks };
                  }
                  // 4. Save Von Neumann Drag-and-Drop
                  const labelTask = document.getElementById('label-task');
                  if (labelTask) {
                      const dropZones = {};
                      labelTask.querySelectorAll('.drop-zone').forEach(zone => {
                          const item = zone.querySelector('.label-item');
                          if (item) dropZones[zone.dataset.answer] = item.dataset.label;
                      });
                      state.interactiveStates['label-task'] = { dropZones };
                  }
                  // 5. Save all Multiple-Choice Quizzes
                  document.querySelectorAll('.quiz-options').forEach(quiz => {
                      if (!quiz.id) return;
                      const selectedOption = quiz.querySelector('li.correct, li.incorrect');
                      if (selectedOption) {
                          const allOptions = Array.from(quiz.querySelectorAll('li'));
                          state.interactiveStates[quiz.id] = { selectedIndex: allOptions.indexOf(selectedOption) };
                      }
                  });
                  return state;
              }

              // --- STATE LOADING LOGIC ---
              function loadWorksheetState(stateToLoad) {
                  if (!stateToLoad) return;
                  if (stateToLoad.inputs) {
                      for (const id in stateToLoad.inputs) {
                          const el = document.getElementById(id);
                          if (el) el.value = stateToLoad.inputs[id];
                      }
                  }
                  if (stateToLoad.interactiveStates) {
                      for (const id in stateToLoad.interactiveStates) {
                          const container = document.getElementById(id);
                          if (!container) continue;
                          const stateData = stateToLoad.interactiveStates[id];
                          if (id === 'matching-task' && stateData.matched) {
                              stateData.matched.forEach(matchId => {
                                  container.querySelectorAll(\`.match-item[data-match="\${matchId}"]\`).forEach(item => item.classList.add('matched'));
                              });
                          } else if (id === 'blanks-task' && stateData.filledBlanks) {
                             for (const key in stateData.filledBlanks) {
                                const blank = container.querySelector(\`.blank-space[data-answer="\${key}"]\`);
                                if (blank) blank.textContent = stateData.filledBlanks[key];
                             }
                             container.querySelector('#check-blanks-btn')?.click();
                          } else if (id === 'label-task' && stateData.dropZones) {
                             const list = container.querySelector('.labels-list');
                             for (const zoneAnswer in stateData.dropZones) {
                                const labelId = stateData.dropZones[zoneAnswer];
                                const zone = container.querySelector(\`.drop-zone[data-answer="\${zoneAnswer}"]\`);
                                const label = list.querySelector(\`.label-item[data-label="\${labelId}"]\`);
                                if (zone && label) {
                                  const placeholder = zone.querySelector('p');
                                  if (placeholder) placeholder.remove();
                                  zone.appendChild(label);
                                }
                             }
                             container.querySelector('#checkVnMatchBtn')?.click();
                          } else if (container.matches('.quiz-options') && stateData.selectedIndex > -1) {
                              const options = container.querySelectorAll('li');
                              if (options[stateData.selectedIndex]) options[stateData.selectedIndex].click();
                          }
                      }
                  }
              }

              // --- AUTO-SAVE POLLING ---
              // This is the new, more robust save mechanism.
              setInterval(() => {
                const currentState = getWorksheetState();
                // Only save if the state has actually changed.
                if (JSON.stringify(currentState) !== JSON.stringify(lastSavedState)) {
                  lastSavedState = currentState;
                  window.parent.postMessage({ type: 'SAVE_WORKSHEET_DATA', payload: currentState }, '*');
                }
              }, 4000); // Check for changes every 4 seconds.
              
              // Load the initial state when the worksheet is ready.
              loadWorksheetState(lastSavedState);
            });
          <\/script>
        `;
                htmlContent = htmlContent.replace('</head>', `${scriptToInject}</head>`);
                setWorksheetHtml(htmlContent);
            } catch (err) {
                console.error("Error preparing worksheet:", err);
                setError("Could not load the worksheet. Please try again.");
            } finally {
                setIsLoading(false);
            }
        };
        prepareWorksheet();
    }, [assignment]);

    const handleIncomingSave = useCallback(async (data) => {
        if (!assignment?.id) return;
        setSaveStatus('saving');
        const assignmentRef = doc(db, 'assignments', assignment.id);
        try {
            await updateDoc(assignmentRef, {
                studentWork: data,
                status: 'In Progress',
            });
            setSaveStatus('saved');
        } catch (err) {
            console.error("Error saving progress:", err);
            setSaveStatus('error');
        } finally {
            setTimeout(() => setSaveStatus('idle'), 2000);
        }
    }, [assignment?.id, db]);

    useEffect(() => {
        const handleMessage = (event) => {
            if (event.data?.type === 'SAVE_WORKSHEET_DATA') {
                handleIncomingSave(event.data.payload);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [handleIncomingSave]);


    if (isLoading) { return <div className="flex items-center justify-center h-screen text-lg">Loading Worksheet...</div>; }
    if (error) { return <div className="p-8 text-center text-red-500 bg-red-50 rounded-lg m-4">{error}</div>; }

    return (
        <div className="flex flex-col h-screen bg-gray-100">
            <header className="flex-shrink-0 bg-white shadow-md z-10 p-3">
                <div className="flex items-center justify-between max-w-7xl mx-auto">
                    <button onClick={() => navigateTo(returnRoute)} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors">
                        &larr; Back to Dashboard
                    </button>
                    <h2 className="text-xl font-bold text-gray-800 hidden md:block truncate px-4">
                        {assignment?.worksheet?.title || 'Worksheet'}
                    </h2>
                    <div className="flex items-center gap-4">
                        <SaveStatusIndicator status={saveStatus} />
                    </div>
                </div>
            </header>
            <main className="flex-grow">
                <iframe
                    srcDoc={worksheetHtml}
                    title={assignment?.worksheet?.title || 'Interactive Worksheet'}
                    className="w-full h-full border-0"
                    sandbox="allow-scripts allow-same-origin allow-forms"
                />
            </main>
        </div>
    );
}

export default WorksheetViewer;