import React, { useState, useEffect, useCallback } from 'react';
import { doc, updateDoc } from 'firebase/firestore';

function WorksheetViewer({ assignment, worksheet, db, isStudentView, navigateTo, returnRoute }) {
  const [iframeSrcDoc, setIframeSrcDoc] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('Saved');

  const worksheetData = isStudentView ? assignment.worksheet : worksheet;

  const processWorksheet = useCallback(async () => {
    if (!worksheetData || !worksheetData.worksheetURL || !worksheetData.fileMap) {
      setError('Invalid worksheet data provided.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(worksheetData.worksheetURL);
      if (!response.ok) throw new Error(`Failed to fetch main HTML: ${response.statusText}`);
      let htmlContent = await response.text();

      // Replace relative paths with absolute URLs
      htmlContent = htmlContent.replace(/ (src|href)="([^"]+)"/g, (match, attr, value) => {
        if (!/^(https?:)?\/\//.test(value)) {
          const fileName = value.split('/').pop();
          if (worksheetData.fileMap[fileName]) {
            return ` ${attr}="${worksheetData.fileMap[fileName]}"`;
          }
        }
        return match;
      });

      // FIX: Inject the saved student work into the HTML before rendering
      if (isStudentView && assignment.studentWork) {
        const scriptToInject = `
          <script>
            window.MGS_HUB_SAVED_STATE = ${JSON.stringify(assignment.studentWork)};
          <\/script>
        `;
        // Inject the script into the <head> of the document
        htmlContent = htmlContent.replace('</head>', `${scriptToInject}</head>`);
      }

      setIframeSrcDoc(htmlContent);
      setError('');
    } catch (err) {
      console.error("Error processing worksheet:", err);
      setError("Could not load the worksheet content.");
    } finally {
      setLoading(false);
    }
  }, [worksheetData, isStudentView, assignment]);

  useEffect(() => {
    processWorksheet();
  }, [processWorksheet]);

  const handleSaveToServer = useCallback(async (studentWork) => {
    if (!isStudentView || !assignment) return;
    setSaveStatus('Saving...');
    try {
      const assignmentRef = doc(db, "assignments", assignment.id);
      await updateDoc(assignmentRef, {
        studentWork: studentWork,
        status: 'In Progress'
      });
      setSaveStatus('Saved');
    } catch (err) {
      console.error("Error saving to server:", err);
      setSaveStatus('Error!');
    }
  }, [isStudentView, assignment, db]);

  useEffect(() => {
    if (!isStudentView) return;

    const handleMessage = (event) => {
      if (!event.data || !event.data.type) return;
      if (event.data.type === 'SAVE_STATE') {
        handleSaveToServer(event.data.payload);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isStudentView, handleSaveToServer]);

  return (
    <div className="bg-white p-8 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => navigateTo(returnRoute)} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">
          &larr; Back to Dashboard
        </button>
        {isStudentView && (
            <div className="text-sm text-gray-500">
                Save Status: <span className="font-semibold">{saveStatus}</span>
            </div>
        )}
      </div>
      <h2 className="text-3xl font-bold mb-2">{worksheetData.title}</h2>
      <p className="text-gray-600 mb-6">{worksheetData.topic}</p>

      <div className="border rounded-lg overflow-hidden" style={{ height: '80vh' }}>
        {loading && <div className="flex items-center justify-center h-full"><p>Loading and assembling worksheet...</p></div>}
        {error && <div className="flex items-center justify-center h-full"><p className="text-red-500">{error}</p></div>}
        {!loading && !error && (
          <iframe
            srcDoc={iframeSrcDoc}
            title={worksheetData.title}
            width="100%"
            height="100%"
            style={{ border: 'none' }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        )}
      </div>
    </div>
  );
}

export default WorksheetViewer;
