// --- Constants ---
const RAM_SIZE = 4; // Number of pages in RAM
const FLASHCARD_DATA_PRIMARY = {
    "ram": "Random Access Memory: Volatile memory that stores currently running programs and data.",
    "rom": "Read-Only Memory: Non-volatile memory containing essential startup instructions (BIOS/firmware).",
    "cache": "Very fast, small memory located on or near the CPU, storing frequently accessed data/instructions.",
    "virtual memory": "Using secondary storage (like HDD/SSD) as if it were RAM when physical RAM is full.",
    "volatile": "Data is lost when the power is turned off.",
    "non-volatile": "Data is retained even when the power is turned off.",
    "swapping": "The process of moving data between RAM and secondary storage (virtual memory).",
    "paging": "The process of managing memory by dividing it into fixed-size blocks called pages.",
    "keywords": "Keywords like RAM, ROM, Volatile etc. will have dotted underlines. Hover over them for definitions if you need a reminder!"
    // Add other keywords as needed
};

// --- State Variables ---
let ramPages = []; // Array to store pages in RAM, e.g., { programName: 'Prog A', pageId: 1, color: 'bg-red-300', timestamp: Date.now() }
let diskPages = []; // Array to store pages swapped to disk
let programs = {}; // Tracks program info, e.g., { 'Prog A': { name: 'Prog A', totalPages: 2, color: 'bg-red-300', pages: [{id:1, location:'ram', ramIndex:0}]} }

// --- DOM Elements ---
let vmRamContainer, vmDiskContainer, vmStatusElement;
let draggedVMPageData = null; // To store data of the page being dragged
let draggedAnalogyItem = null; // For Task 3 Analogy Matching
let currentBootStep = 0; // For Task 4 Boot Sequence
const BOOT_SIM_DELAY = 1500; // Delay in ms for boot simulation steps (Adjusted)
let draggedCacheItem = null; // For Extension Task Cache Levels

// --- Scoring ---
let currentScore = 0;
const TOTAL_POSSIBLE_SCORE = 16; // Task1 (5) + Task2 (6) + Task3 (4) + Task5 (1)
const CHARS_PER_MARK_THRESHOLD_TASK6 = 15; // Min chars per mark for Task 6 exam questions

document.addEventListener('DOMContentLoaded', () => {
    vmRamContainer = document.getElementById('vm-ram-container');
    vmDiskContainer = document.getElementById('vm-disk-container');
    vmStatusElement = document.getElementById('vm-status');

    if (vmRamContainer && vmDiskContainer && vmStatusElement) {
        initializeVM();
    } else {
        console.warn("VM simulation containers not found. VM Sim will not initialize.");
    }

    // Setup for quiz items (Starter, Task 1, 2, 5, Extension RAM Types)
    document.querySelectorAll('#task0-starter .quiz-item, #quick-check .quiz-item, #memory-comparison .quiz-item, #virtual-memory-sim .quiz-item, #extension-ram-types .quiz-item').forEach(item => {
        item.querySelectorAll('.option-button').forEach(button => {
            const isStarterTask = item.closest('#task0-starter') !== null;
            const isExtensionTask = item.closest('.extension-task') !== null;
            button.addEventListener('click', () => handleOptionClick(button, isStarterTask || isExtensionTask)); // Treat extension as non-scoring like starter
        });
    });

    // Setup for reveal buttons
    window.toggleReveal = window.toggleReveal || function(contentId, buttonElement, revealText, hideText) {
        const content = document.getElementById(contentId);
        if (!content || !buttonElement) return;
        const isHidden = content.classList.contains('hidden') || !content.classList.contains('show');
        
        content.classList.toggle('hidden', !isHidden);
        content.classList.toggle('show', isHidden);

        buttonElement.textContent = isHidden ? hideText : revealText;
    };

    addTooltipsPrimary();
    setupAnalogyDragDropListeners(); // For Task 3
    setupCacheDragDropListeners(); // For Extension Task Cache Levels

    // Event Listeners for Task 4: Boot Sequence
    const startBootBtn = document.getElementById('start-boot-sim');
    if (startBootBtn) startBootBtn.addEventListener('click', startBootSimulation);
    const resetBootBtn = document.getElementById('reset-boot-sim');
    if (resetBootBtn) resetBootBtn.addEventListener('click', resetBootSimulation);

    // Event Listeners for Task 6: Exam Practice Mark Scheme Buttons
    document.querySelectorAll('#exam-practice .mark-scheme-button').forEach(button => {
        button.addEventListener('click', () => {
            const feedbackId = button.dataset.feedbackId;
            if (feedbackId) toggleMarkSchemeVisibility(feedbackId);
        });
    });
    // Setup for Task 6 Exam Practice textareas and self-assessment
    document.querySelectorAll('#exam-practice .exam-question').forEach(questionDiv => {
        const textarea = questionDiv.querySelector('.exam-answer-textarea');
        if (textarea) {
            textarea.addEventListener('input', handleExamAnswerInputTask6);
            handleExamAnswerInputTask6({ target: textarea }); // Initial check
        }
        const selfAssessInput = questionDiv.querySelector('.self-assess-input');
        const marks = parseInt(questionDiv.dataset.marks, 10);
        if (selfAssessInput && !isNaN(marks)) {
            selfAssessInput.max = marks;
        }
    });

    // Event Listener for Task 7: Calculate Score Button
    const calculateScoreBtn = document.getElementById('calculate-score-btn');
    if (calculateScoreBtn) {
        calculateScoreBtn.addEventListener('click', calculateUserScore);
    }
    const totalPossibleScoreEl = document.getElementById('total-possible-score');
    if (totalPossibleScoreEl) {
        totalPossibleScoreEl.textContent = TOTAL_POSSIBLE_SCORE;
    }

    // Initialize current year in footer
    const currentYearSpan = document.getElementById('currentYear');
    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }
});

function addTooltipsPrimary() {
    document.querySelectorAll('.keyword').forEach(span => {
        const keywordText = span.textContent.trim().toLowerCase().replace(/[^\w\s]/gi, ''); 
        if (FLASHCARD_DATA_PRIMARY[keywordText]) {
            const tooltipText = FLASHCARD_DATA_PRIMARY[keywordText];
            if (!span.querySelector('.tooltip')) {
                const tooltip = document.createElement('span');
                tooltip.className = 'tooltip';
                tooltip.textContent = tooltipText;
                span.appendChild(tooltip);
            }
        }
    });
}


function initializeVM() {
    ramPages = new Array(RAM_SIZE).fill(null);
    diskPages = [];
    programs = {};
    updateVMDisplay();
    updateVMStatus('Ready. RAM is empty.');

    if (vmRamContainer) {
        vmRamContainer.addEventListener('dragover', handleVMContainerDragOver);
        vmRamContainer.addEventListener('drop', (event) => handleVMContainerDrop(event, 'ram'));
        vmRamContainer.addEventListener('dragleave', handleVMContainerDragLeave);
    }
    if (vmDiskContainer) {
        vmDiskContainer.addEventListener('dragover', handleVMContainerDragOver);
        vmDiskContainer.addEventListener('drop', (event) => handleVMContainerDrop(event, 'disk'));
        vmDiskContainer.addEventListener('dragleave', handleVMContainerDragLeave);
    }
}

function getProgramColor(programName) {
    const initial = programName.charAt(programName.length - 1).toUpperCase();
    const colors = {
        'A': 'bg-red-300 border-red-500',
        'B': 'bg-green-300 border-green-500',
        'C': 'bg-blue-300 border-blue-500',
        'D': 'bg-purple-300 border-purple-500',
    };
    return colors[initial] || 'bg-gray-300 border-gray-500';
}

function updateVMDisplay() {
    if (!vmRamContainer || !vmDiskContainer) return;

    vmRamContainer.innerHTML = '';
    ramPages.forEach((page, index) => {
        const pageDiv = createVMPageElement(page, 'ram', index);
        vmRamContainer.appendChild(pageDiv);
    });

    vmDiskContainer.innerHTML = '';
    diskPages.forEach((page, index) => {
        const pageDiv = createVMPageElement(page, 'disk', index);
        vmDiskContainer.appendChild(pageDiv);
    });
}

function createVMPageElement(page, sourceType, sourceIndex) {
    const pageDiv = document.createElement('div');
    pageDiv.className = 'vm-page p-2 border text-center text-xs min-h-[40px] flex items-center justify-center cursor-grab';
    if (page) {
        pageDiv.textContent = `${page.programName} - P${page.pageId}`;
        pageDiv.className += ` ${page.color}`;
        if (sourceType === 'disk') { 
            pageDiv.className += ' bg-yellow-200 !border-yellow-500';
        }
        pageDiv.draggable = true;
        pageDiv.dataset.programName = page.programName;
        pageDiv.dataset.pageId = page.pageId;
        pageDiv.dataset.sourceType = sourceType; 
        pageDiv.dataset.sourceIndex = sourceIndex; 
        pageDiv.addEventListener('dragstart', handleVMPageDragStart);
        pageDiv.addEventListener('dragend', handleVMPageDragEnd);
    } else {
        pageDiv.textContent = 'Empty';
        pageDiv.className += ' bg-gray-100 border-gray-300';
        pageDiv.draggable = false; 
    }
    return pageDiv;
}

function updateVMStatus(message) {
    if (vmStatusElement) vmStatusElement.textContent = `Status: ${message}`;
}

function loadProgramVM(programName, numPages) {
    if (!programs[programName]) {
        programs[programName] = {
            name: programName,
            totalPages: numPages,
            color: getProgramColor(programName),
            pages: [] 
        };
    } else {
        let existingPageCount = programs[programName].pages.length;
        if (existingPageCount >= numPages) {
            updateVMStatus(`All ${numPages} pages of ${programName} are already in the system (RAM or Disk).`);
            return;
        }
    }

    let pagesSuccessfullyLoadedToRam = 0;
    let pagesToDisk = 0;

    for (let i = 1; i <= numPages; i++) {
        const existingPageEntry = programs[programName].pages.find(p => p.id === i);
        if (existingPageEntry) continue; 

        const newPageData = { programName: programName, pageId: i, color: programs[programName].color, timestamp: Date.now() };
        let ramIndex = ramPages.indexOf(null);

        if (ramIndex !== -1) { 
            ramPages[ramIndex] = newPageData;
            programs[programName].pages.push({ id: i, location: 'ram', ramIndex: ramIndex });
            pagesSuccessfullyLoadedToRam++;
        } else { 
            let lruRamIndexToSwap = -1;
            let minTimestamp = Infinity;
            
            for (let j = 0; j < RAM_SIZE; j++) {
                if (ramPages[j] && ramPages[j].programName !== programName && ramPages[j].timestamp < minTimestamp) {
                    minTimestamp = ramPages[j].timestamp;
                    lruRamIndexToSwap = j;
                }
            }
            if (lruRamIndexToSwap === -1) {
                minTimestamp = Infinity;
                for (let j = 0; j < RAM_SIZE; j++) {
                    if (ramPages[j] && ramPages[j].timestamp < minTimestamp) {
                        minTimestamp = ramPages[j].timestamp;
                        lruRamIndexToSwap = j;
                    }
                }
            }

            if (lruRamIndexToSwap !== -1) { 
                const pageToSwap = ramPages[lruRamIndexToSwap];
                diskPages.push(pageToSwap);
                
                const swappedProgram = programs[pageToSwap.programName];
                if (swappedProgram) {
                    const swappedPageEntry = swappedProgram.pages.find(p => p.id === pageToSwap.pageId && p.location === 'ram');
                    if (swappedPageEntry) {
                        swappedPageEntry.location = 'disk';
                        swappedPageEntry.diskIndex = diskPages.length - 1; 
                        delete swappedPageEntry.ramIndex;
                    }
                }

                ramPages[lruRamIndexToSwap] = newPageData;
                programs[programName].pages.push({ id: i, location: 'ram', ramIndex: lruRamIndexToSwap });
                pagesSuccessfullyLoadedToRam++;
            } else { 
                diskPages.push(newPageData);
                programs[programName].pages.push({ id: i, location: 'disk', diskIndex: diskPages.length -1 });
                pagesToDisk++;
            }
        }
    }

    let statusMsg = `For ${programName}: `;
    if (pagesSuccessfullyLoadedToRam > 0) statusMsg += `${pagesSuccessfullyLoadedToRam} page(s) loaded to RAM. `;
    if (pagesToDisk > 0) statusMsg += `${pagesToDisk} page(s) loaded to Disk (due to full RAM). `;
    if (pagesSuccessfullyLoadedToRam === 0 && pagesToDisk === 0) {
        if (programs[programName] && programs[programName].pages.length >= numPages) {
            statusMsg = `All pages of ${programName} were already in the system.`;
        } else {
            statusMsg = `No new pages loaded for ${programName}. Check program size and available memory.`;
        }
    }
    updateVMStatus(statusMsg.trim());
    updateVMDisplay();
}

function finishProgramVM(programName) {
    if (!programs[programName]) {
        updateVMStatus(`${programName} not found.`);
        return;
    }

    const programPagesInfo = programs[programName].pages;
    for (const page of programPagesInfo) {
        if (page.location === 'disk') {
            updateVMStatus(`Cannot finish ${programName}. Page ${page.id} is on Disk. Drag it to RAM first.`);
            return;
        }
    }

    let pagesFreedCount = 0;
    for (let i = 0; i < RAM_SIZE; i++) {
        if (ramPages[i] && ramPages[i].programName === programName) {
            ramPages[i] = null;
            pagesFreedCount++;
        }
    }
    const initialDiskCount = diskPages.length;
    diskPages = diskPages.filter(page => page.programName !== programName);
    // pagesFreedCount += (initialDiskCount - diskPages.length); // This was double counting if pages were only in RAM

    delete programs[programName];
    let finishStatus = `Finished ${programName}. Freed ${pagesFreedCount} RAM page slot(s).`;
    if ((initialDiskCount - diskPages.length) > 0) {
        finishStatus += ` Also removed ${(initialDiskCount - diskPages.length)} page(s) of ${programName} from disk.`;
    }


    const diskPagesToConsider = [...diskPages]; 
    for (const pageOnDisk of diskPagesToConsider) {
        let freeRamIndex = ramPages.indexOf(null);
        if (freeRamIndex !== -1) {
            ramPages[freeRamIndex] = pageOnDisk; 
            
            const originalDiskIndex = diskPages.findIndex(p => p.programName === pageOnDisk.programName && p.pageId === pageOnDisk.pageId);
            if (originalDiskIndex !== -1) {
                diskPages.splice(originalDiskIndex, 1);
            }

            const pageProgram = programs[pageOnDisk.programName]; 
            if (pageProgram) {
                const pageEntry = pageProgram.pages.find(p => p.id === pageOnDisk.pageId && p.location === 'disk');
                if (pageEntry) {
                    pageEntry.location = 'ram';
                    pageEntry.ramIndex = freeRamIndex;
                    delete pageEntry.diskIndex;
                }
            }
            finishStatus += ` Moved ${pageOnDisk.programName}-P${pageOnDisk.pageId} from disk to RAM.`;
        } else {
            break; 
        }
    }
    updateVMStatus(finishStatus);
    updateVMDisplay();
}

function resetVMSim() {
    initializeVM(); 
    const vmQuizItem = document.querySelector('#virtual-memory-sim .quiz-item');
    if (vmQuizItem) {
        vmQuizItem.querySelectorAll('.option-button').forEach(btn => {
            btn.classList.remove('correct', 'incorrect', 'selected');
            btn.disabled = false;
        });
        const feedback = vmQuizItem.querySelector('.feedback');
        if (feedback) {
            feedback.innerHTML = ''; 
            feedback.className = 'feedback mt-1';
        }
        vmQuizItem.dataset.answered = "false";
    }
}

function handleOptionClick(button, isNonScoringTask) { // Renamed second param for clarity
    const quizItem = button.closest('.quiz-item');
    if (!quizItem || quizItem.dataset.answered === "true") return;

    const correctAnswer = quizItem.dataset.correct;
    const selectedAnswer = button.dataset.answer;
    const feedbackDiv = quizItem.querySelector('.feedback');
    const points = isNonScoringTask ? 0 : (parseInt(quizItem.dataset.points) || 0); // Points only if not starter/extension

    quizItem.querySelectorAll('.option-button').forEach(btn => {
        btn.disabled = true;
        btn.classList.remove('selected');
    });
    button.classList.add('selected');

    if (selectedAnswer === correctAnswer) {
        button.classList.add('correct');
        if (feedbackDiv) feedbackDiv.innerHTML = '<span class="text-green-600 font-semibold"><i class="fas fa-check mr-1"></i>Correct!</span>';
        // if (points > 0) { /* Scoring handled by calculateUserScore */ }
    } else {
        button.classList.add('incorrect');
        if (feedbackDiv) {
            let explanation = "The selected answer was not correct.";
            if (quizItem.closest('#task0-starter')) { 
                 if (quizItem.querySelector('p').textContent.includes("RAM is non-volatile")) explanation = "RAM is volatile (loses data without power).";
                 else if (quizItem.querySelector('p').textContent.includes("RAM is an example")) explanation = "RAM is primary storage.";
                 else if (quizItem.querySelector('p').textContent.includes("faster for the CPU")) explanation = "Primary storage is faster for direct CPU access.";
            } else if (quizItem.closest('#virtual-memory-sim')) {
                explanation = "Virtual memory slows down performance due to disk access.";
            } else if (quizItem.closest('#extension-ram-types')) {
                if (quizItem.querySelector('p').textContent.includes("DDR stand for")) explanation = "DDR stands for Double Data Rate.";
                else if (quizItem.querySelector('p').textContent.includes("DDR4 RAM generally offers")) explanation = "DDR4 is faster and more power efficient than DDR3.";
                else if (quizItem.querySelector('p').textContent.includes("DDR5 RAM into a motherboard")) explanation = "DDR generations are not backward/forward compatible due to physical and electrical differences.";
            }
            feedbackDiv.innerHTML = `<span class="text-red-600 font-semibold"><i class="fas fa-times mr-1"></i>Incorrect.</span> ${explanation}`;
        }
        quizItem.querySelectorAll('.option-button').forEach(btn => {
            if (btn.dataset.answer === correctAnswer) {
                btn.classList.add('correct'); 
            }
        });
    }
    quizItem.dataset.answered = "true";
}

// --- VM Drag and Drop Handlers ---
function handleVMPageDragStart(event) {
    const pageDiv = event.target;
    let fullPageObject;
    if (pageDiv.dataset.sourceType === 'ram') {
        fullPageObject = ramPages[parseInt(pageDiv.dataset.sourceIndex)];
    } else { 
        fullPageObject = diskPages[parseInt(pageDiv.dataset.sourceIndex)];
    }

    if (!fullPageObject) { 
        console.error("DragStart: Could not find page object for", pageDiv.dataset);
        event.preventDefault(); 
        return;
    }
    
    draggedVMPageData = { ...fullPageObject, 
        sourceType: pageDiv.dataset.sourceType, 
        sourceIndex: parseInt(pageDiv.dataset.sourceIndex)
    };

    event.dataTransfer.setData('text/plain', `${draggedVMPageData.programName}-P${draggedVMPageData.pageId}`);
    event.dataTransfer.effectAllowed = 'move';
    pageDiv.classList.add('opacity-50'); 
}

function handleVMPageDragEnd(event) {
    event.target.classList.remove('opacity-50');
    if (vmRamContainer) vmRamContainer.classList.remove('bg-blue-100', 'border-blue-400');
    if (vmDiskContainer) vmDiskContainer.classList.remove('bg-yellow-100', 'border-yellow-400');
}

function handleVMContainerDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (draggedVMPageData) { 
        if (event.currentTarget === vmRamContainer && draggedVMPageData.sourceType === 'disk') {
            event.currentTarget.classList.add('bg-blue-100', 'border-blue-400');
        } else if (event.currentTarget === vmDiskContainer && draggedVMPageData.sourceType === 'ram') {
            event.currentTarget.classList.add('bg-yellow-100', 'border-yellow-400');
        }
    }
}

function handleVMContainerDragLeave(event) {
    if (event.currentTarget === vmRamContainer) {
        event.currentTarget.classList.remove('bg-blue-100', 'border-blue-400');
    } else if (event.currentTarget === vmDiskContainer) {
        event.currentTarget.classList.remove('bg-yellow-100', 'border-yellow-400');
    }
}

function handleVMContainerDrop(event, destinationType) {
    event.preventDefault();
    if (vmRamContainer) vmRamContainer.classList.remove('bg-blue-100', 'border-blue-400');
    if (vmDiskContainer) vmDiskContainer.classList.remove('bg-yellow-100', 'border-yellow-400');

    if (!draggedVMPageData || draggedVMPageData.sourceType === destinationType) {
        draggedVMPageData = null; 
        return; 
    }

    const pageObjectToStore = { 
        programName: draggedVMPageData.programName,
        pageId: draggedVMPageData.pageId,
        color: draggedVMPageData.color,
        timestamp: draggedVMPageData.timestamp 
    };

    if (destinationType === 'ram') { 
        const emptyRamSlot = ramPages.indexOf(null);
        if (emptyRamSlot === -1) {
            updateVMStatus(`RAM is full. Drag a page from RAM to Disk to make space for ${pageObjectToStore.programName}-P${pageObjectToStore.pageId}.`);
            draggedVMPageData = null;
            return;
        }
        diskPages.splice(draggedVMPageData.sourceIndex, 1);
        pageObjectToStore.timestamp = Date.now(); 
        ramPages[emptyRamSlot] = pageObjectToStore;

        const progEntry = programs[pageObjectToStore.programName]?.pages.find(p => p.id === pageObjectToStore.pageId);
        if (progEntry) {
            progEntry.location = 'ram';
            progEntry.ramIndex = emptyRamSlot;
            delete progEntry.diskIndex;
        }
        updateVMStatus(`Moved ${pageObjectToStore.programName}-P${pageObjectToStore.pageId} from Disk to RAM.`);

    } else { // Moving to Disk 
        ramPages[draggedVMPageData.sourceIndex] = null;
        diskPages.push(pageObjectToStore); 

        const progEntry = programs[pageObjectToStore.programName]?.pages.find(p => p.id === pageObjectToStore.pageId);
        if (progEntry) {
            progEntry.location = 'disk';
            progEntry.diskIndex = diskPages.length - 1;
            delete progEntry.ramIndex;
        }
        updateVMStatus(`Moved ${pageObjectToStore.programName}-P${pageObjectToStore.pageId} from RAM to Disk.`);
    }

    updateVMDisplay();
    draggedVMPageData = null; 
}

window.loadProgramVM = loadProgramVM;
window.finishProgramVM = finishProgramVM;
window.resetVMSim = resetVMSim;

// --- Task 3: Analogy Matching ---
function setupAnalogyDragDropListeners() {
    document.querySelectorAll('.analogy-draggable').forEach(item => {
        item.addEventListener('dragstart', dragAnalogyItem);
        item.addEventListener('dragend', handleAnalogyDragEnd);
    });
    document.querySelectorAll('.analogy-dropzone, #analogy-pool').forEach(zone => {
        zone.addEventListener('dragover', allowAnalogyDrop);
        zone.addEventListener('drop', dropAnalogyItem);
        zone.addEventListener('dragleave', handleAnalogyDragLeave);
    });
}

function allowAnalogyDrop(ev) {
    ev.preventDefault();
    if (draggedAnalogyItem && (ev.currentTarget.classList.contains('analogy-dropzone') || ev.currentTarget.id === 'analogy-pool')) {
        ev.currentTarget.classList.add('over');
    }
}

function dragAnalogyItem(ev) {
    draggedAnalogyItem = ev.target;
    ev.dataTransfer.setData("text/plain", ev.target.id);
    ev.dataTransfer.effectAllowed = "move";
    setTimeout(() => { if (draggedAnalogyItem) draggedAnalogyItem.classList.add('dragging'); }, 0);
}

function dropAnalogyItem(ev) {
    ev.preventDefault();
    let dropTarget = ev.currentTarget; 

    if ((dropTarget.classList.contains('analogy-dropzone') || dropTarget.id === 'analogy-pool') && draggedAnalogyItem) {
        if (dropTarget.classList.contains('analogy-dropzone') && 
            dropTarget.children.length > 0 && 
            dropTarget.children[0].classList.contains('analogy-draggable') &&
            dropTarget.children[0] !== draggedAnalogyItem) { 
            document.getElementById('analogy-pool').appendChild(dropTarget.children[0]);
        }
        dropTarget.appendChild(draggedAnalogyItem);
    }
    if (dropTarget) dropTarget.classList.remove('over'); 
    if (draggedAnalogyItem) draggedAnalogyItem.classList.remove('dragging');
    draggedAnalogyItem = null;
}

function handleAnalogyDragLeave(ev) {
    if (ev.currentTarget.classList.contains('analogy-dropzone') || ev.currentTarget.id === 'analogy-pool') {
        ev.currentTarget.classList.remove('over');
    }
}

function handleAnalogyDragEnd(ev) {
    if (draggedAnalogyItem) {
        draggedAnalogyItem.classList.remove('dragging');
        if (ev.dataTransfer.dropEffect !== 'move' && 
            draggedAnalogyItem.parentElement && 
            draggedAnalogyItem.parentElement.id !== 'analogy-pool') {
             document.getElementById('analogy-pool').appendChild(draggedAnalogyItem); 
        }
    }
    document.querySelectorAll('.analogy-dropzone.over, #analogy-pool.over').forEach(el => el.classList.remove('over'));
    draggedAnalogyItem = null;
}

function checkAnalogyMatches() {
    const feedbackElement = document.getElementById('analogy-feedback');
    if (!feedbackElement) return;
    let correctMatches = 0;
    let feedbackHtml = "<ul>";
    document.querySelectorAll('.analogy-dropzone').forEach(zone => {
        zone.classList.remove('correct-analogy', 'incorrect-analogy');
        const draggableItem = zone.querySelector('.analogy-draggable');
        const zoneDescription = zone.querySelector('span')?.textContent || "this zone";

        if (draggableItem) {
            if (draggableItem.dataset.type === zone.dataset.accept) {
                correctMatches++;
                zone.classList.add('correct-analogy');
                feedbackHtml += `<li class="correct-feedback"><i class="fas fa-check mr-1"></i>Correct: ${draggableItem.textContent} matches "${zoneDescription}"</li>`;
            } else {
                zone.classList.add('incorrect-analogy');
                feedbackHtml += `<li class="incorrect-feedback"><i class="fas fa-times mr-1"></i>Incorrect: ${draggableItem.textContent} for "${zoneDescription}" (Expected: ${zone.dataset.accept.toUpperCase()})</li>`;
            }
        } else {
             feedbackHtml += `<li class="incorrect-feedback"><i class="fas fa-times mr-1"></i>Missing item for: "${zoneDescription}"</li>`;
        }
    });
    feedbackHtml += "</ul>";
    if (correctMatches === 4) { 
        feedbackElement.innerHTML = `<p class="correct-feedback font-semibold"><i class="fas fa-check mr-2"></i>All analogies matched correctly!</p>`;
    } else {
        feedbackElement.innerHTML = `<p class="incorrect-feedback font-semibold"><i class="fas fa-times mr-2"></i>Some analogies are incorrect or missing. You got ${correctMatches}/4.</p>${feedbackHtml}`;
    }
    feedbackElement.classList.add('show');
}
window.checkAnalogyMatches = checkAnalogyMatches; 

function resetAnalogyMatches() {
    const pool = document.getElementById('analogy-pool');
    if (pool) {
        document.querySelectorAll('.analogy-draggable:not(.extension-draggable)').forEach(item => pool.appendChild(item)); // Ensure only analogy items
    }
    document.querySelectorAll('.analogy-dropzone').forEach(zone => {
        zone.classList.remove('correct-analogy', 'incorrect-analogy', 'over');
    });
    const feedback = document.getElementById('analogy-feedback');
    if (feedback) {
        feedback.innerHTML = ''; 
        feedback.classList.remove('show');
    }
}
window.resetAnalogyMatches = resetAnalogyMatches; 

// --- Task 4: Boot Sequence Simulation ---
function simulateBootStep() {
    const steps = document.querySelectorAll('#boot-sequence-steps li');
    if (currentBootStep < steps.length) {
        steps[currentBootStep].classList.add('active-step'); 
        currentBootStep++;
        if (currentBootStep < steps.length) {
            setTimeout(simulateBootStep, BOOT_SIM_DELAY);
        } else {
            const startBtn = document.getElementById('start-boot-sim');
            if(startBtn) startBtn.disabled = true;
        }
    }
}

function startBootSimulation() {
    resetBootSimulation(); 
    const startBtn = document.getElementById('start-boot-sim');
    if(startBtn) startBtn.disabled = true;
    simulateBootStep();
}

function resetBootSimulation() {
    currentBootStep = 0;
    document.querySelectorAll('#boot-sequence-steps li').forEach(li => li.classList.remove('active-step'));
    const startBtn = document.getElementById('start-boot-sim');
    if(startBtn) startBtn.disabled = false;
}

// --- Task 6: Exam Practice - Toggle Mark Scheme & Character Count ---
function toggleMarkSchemeVisibility(feedbackId) {
    const feedbackDiv = document.getElementById(feedbackId);
    if (feedbackDiv) {
        feedbackDiv.classList.toggle('hidden');
        feedbackDiv.classList.toggle('show'); 
    }
}

function handleExamAnswerInputTask6(event) {
    const textarea = event.target;
    const questionDiv = textarea.closest('.exam-question');
    if (!questionDiv) return;

    const marksText = questionDiv.dataset.marks;
    if (marksText === undefined) {
        console.warn("Exam question div (Task 6) is missing 'data-marks' attribute:", questionDiv);
        return;
    }
    const marks = parseInt(marksText, 10);
    const markSchemeButton = document.getElementById(textarea.dataset.buttonId);

    if (isNaN(marks) || !markSchemeButton) {
        console.error("Could not parse marks or find mark scheme button for Task 6 exam question.", questionDiv, textarea.dataset.buttonId);
        return;
    }

    const requiredLength = marks * CHARS_PER_MARK_THRESHOLD_TASK6;
    const currentLength = textarea.value.trim().length;

    markSchemeButton.disabled = currentLength < requiredLength;
    markSchemeButton.title = markSchemeButton.disabled ? `Type at least ${requiredLength - currentLength} more characters to unlock. (${currentLength}/${requiredLength})` : "Show the mark scheme";
}

// --- Task 7: Scoring ---
function calculateUserScore() {
    currentScore = 0;
    // Task 1: Quick Check
    document.querySelectorAll('#quick-check .quiz-item').forEach(item => {
        if (item.dataset.answered === "true" && item.querySelector('.option-button.selected.correct')) {
            currentScore += parseInt(item.dataset.points) || 0;
        }
    });
    // Task 2: Memory Comparison
    document.querySelectorAll('#memory-comparison .quiz-item').forEach(item => {
        if (item.dataset.answered === "true" && item.querySelector('.option-button.selected.correct')) {
            currentScore += parseInt(item.dataset.points) || 0;
        }
    });
    // Task 3: Analogy Matching
    let analogyScore = 0;
    document.querySelectorAll('.analogy-dropzone').forEach(zone => {
        const draggableItem = zone.querySelector('.analogy-draggable:not(.extension-draggable)'); // Ensure not extension item
        if (draggableItem && draggableItem.dataset.type === zone.dataset.accept) {
            analogyScore++;
        }
    });
    currentScore += analogyScore; 

    // Task 5: Virtual Memory Sim (Quiz Question part)
    const vmQuizItem = document.querySelector('#virtual-memory-sim .quiz-item');
    if (vmQuizItem && vmQuizItem.dataset.answered === "true" && vmQuizItem.querySelector('.option-button.selected.correct')) {
        currentScore += parseInt(vmQuizItem.dataset.points) || 0;
    }

    const currentScoreEl = document.getElementById('current-score');
    if (currentScoreEl) {
        currentScoreEl.textContent = currentScore;
    }
}

// --- Extension Task: Cache Levels ---
function setupCacheDragDropListeners() {
    document.querySelectorAll('.extension-draggable').forEach(item => {
        item.addEventListener('dragstart', dragCacheItem);
        item.addEventListener('dragend', handleCacheDragEnd);
    });
    document.querySelectorAll('.extension-dropzone, #cache-pool').forEach(zone => {
        zone.addEventListener('dragover', allowCacheDrop);
        zone.addEventListener('drop', dropCacheItem);
        zone.addEventListener('dragleave', handleCacheDragLeave);
    });
}

function allowCacheDrop(ev) {
    ev.preventDefault();
    if (draggedCacheItem && (ev.currentTarget.classList.contains('extension-dropzone') || ev.currentTarget.id === 'cache-pool')) {
        ev.currentTarget.classList.add('over');
    }
}

function dragCacheItem(ev) {
    draggedCacheItem = ev.target;
    ev.dataTransfer.setData("text/plain", ev.target.id);
    ev.dataTransfer.effectAllowed = "move";
    setTimeout(() => { if (draggedCacheItem) draggedCacheItem.classList.add('dragging'); }, 0);
}

function dropCacheItem(ev) {
    ev.preventDefault();
    let dropTarget = ev.currentTarget;
    if ((dropTarget.classList.contains('extension-dropzone') || dropTarget.id === 'cache-pool') && draggedCacheItem) {
        if (dropTarget.classList.contains('extension-dropzone') && dropTarget.children.length > 0 && dropTarget.children[0].classList.contains('extension-draggable')) {
            document.getElementById('cache-pool').appendChild(dropTarget.children[0]);
        }
        dropTarget.appendChild(draggedCacheItem);
    }
    if(dropTarget) dropTarget.classList.remove('over');
    if (draggedCacheItem) draggedCacheItem.classList.remove('dragging');
    draggedCacheItem = null;
}

function handleCacheDragLeave(ev) {
    if (ev.currentTarget.classList.contains('extension-dropzone') || ev.currentTarget.id === 'cache-pool') {
        ev.currentTarget.classList.remove('over');
    }
}

function handleCacheDragEnd(ev) {
    if (draggedCacheItem) {
        draggedCacheItem.classList.remove('dragging');
        if (ev.dataTransfer.dropEffect !== 'move' && draggedCacheItem.parentElement && draggedCacheItem.parentElement.id !== 'cache-pool') {
            document.getElementById('cache-pool').appendChild(draggedCacheItem);
        }
    }
    document.querySelectorAll('.extension-dropzone.over, #cache-pool.over').forEach(el => el.classList.remove('over'));
    draggedCacheItem = null;
}

function checkCacheMatches() {
    const feedbackElement = document.getElementById('cache-feedback');
    if (!feedbackElement) return;
    let correctMatches = 0;
    let feedbackHtml = "<ul>";
    document.querySelectorAll('#extension-cache .extension-dropzone').forEach(zone => {
        zone.classList.remove('correct-analogy', 'incorrect-analogy'); // Re-use analogy styles
        const draggableItem = zone.querySelector('.extension-draggable');
        const zoneDescription = zone.querySelector('span')?.textContent || "this zone";
        if (draggableItem) {
            if (draggableItem.dataset.type === zone.dataset.accept) {
                correctMatches++;
                zone.classList.add('correct-analogy');
                feedbackHtml += `<li class="correct-feedback"><i class="fas fa-check mr-1"></i>Correct: ${draggableItem.textContent} matches "${zoneDescription}"</li>`;
            } else {
                zone.classList.add('incorrect-analogy');
                feedbackHtml += `<li class="incorrect-feedback"><i class="fas fa-times mr-1"></i>Incorrect: ${draggableItem.textContent} for "${zoneDescription}"</li>`;
            }
        } else {
            feedbackHtml += `<li class="incorrect-feedback"><i class="fas fa-times mr-1"></i>Missing item for: "${zoneDescription}"</li>`;
        }
    });
    feedbackHtml += "</ul>";
    if (correctMatches === 3) { // 3 cache levels
        feedbackElement.innerHTML = `<p class="correct-feedback font-semibold"><i class="fas fa-check mr-2"></i>All cache levels matched correctly!</p>`;
    } else {
        feedbackElement.innerHTML = `<p class="incorrect-feedback font-semibold"><i class="fas fa-times mr-2"></i>Some cache levels are incorrect or missing. You got ${correctMatches}/3.</p>${feedbackHtml}`;
    }
    feedbackElement.classList.add('show');
}
window.checkCacheMatches = checkCacheMatches;

function resetCacheMatches() {
    const pool = document.getElementById('cache-pool');
    if (pool) {
        document.querySelectorAll('#extension-cache .extension-draggable').forEach(item => pool.appendChild(item));
    }
    document.querySelectorAll('#extension-cache .extension-dropzone').forEach(zone => {
        zone.classList.remove('correct-analogy', 'incorrect-analogy', 'over');
    });
    const feedback = document.getElementById('cache-feedback');
    if (feedback) {
        feedback.innerHTML = '';
        feedback.classList.remove('show');
    }
}
window.resetCacheMatches = resetCacheMatches;

// --- Reset All Tasks Function (Example, if you want one for this page) ---
// This function would need to be called by a "Reset All" button if you add one.
/*
function resetAllWorksheetTasks() {
    resetAnalogyMatches();
    resetBootSimulation();
    resetVMSim();
    resetCacheMatches();

    // Reset Task 1, 2, Extension RAM quiz items
    document.querySelectorAll('#quick-check .quiz-item, #memory-comparison .quiz-item, #extension-ram-types .quiz-item').forEach(item => {
        item.querySelectorAll('.option-button').forEach(btn => {
            btn.classList.remove('correct', 'incorrect', 'selected');
            btn.disabled = false;
        });
        const feedback = item.querySelector('.feedback');
        if (feedback) feedback.innerHTML = '';
        item.dataset.answered = "false";
    });

    // Reset Task 6 Exam Practice
    document.querySelectorAll('#exam-practice .exam-question').forEach(questionDiv => {
        const textarea = questionDiv.querySelector('.exam-answer-textarea');
        if (textarea) {
            textarea.value = '';
            handleExamAnswerInputTask6({ target: textarea }); // Reset button state
        }
        const selfAssessInput = questionDiv.querySelector('.self-assess-input');
        if (selfAssessInput) selfAssessInput.value = '';

        const markSchemeButton = document.getElementById(textarea.dataset.buttonId);
        if (markSchemeButton) {
            const markSchemeDiv = document.getElementById(markSchemeButton.dataset.feedbackId);
            if (markSchemeDiv) {
                markSchemeDiv.classList.add('hidden');
                markSchemeDiv.classList.remove('show');
            }
        }
    });

    // Reset score display for Task 7
    const scoreDisplay = document.getElementById('current-score');
    if (scoreDisplay) scoreDisplay.textContent = '0';

    // Reset starter task textarea and reveal
    const starterTextarea = document.querySelector('#task0-starter .explanation-textarea');
    if (starterTextarea) starterTextarea.value = '';
    const starterRevealContent = document.getElementById('starter-answer-primary');
    if (starterRevealContent && starterRevealContent.classList.contains('show')) {
        const starterRevealButton = document.querySelector('#task0-starter .reveal-button');
        if (starterRevealButton) toggleReveal('starter-answer-primary', starterRevealButton, 'Reveal Answer', 'Hide Answer');
    }
    
    // Reset extension task textareas
    document.querySelectorAll('.extension-task textarea.explanation-textarea').forEach(ta => ta.value = '');

    console.log("All relevant tasks reset for Primary Storage worksheet.");
}
// Add a button to HTML to call resetAllWorksheetTasks() if desired.
*/
