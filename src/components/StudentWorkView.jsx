import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';

function StudentWorkView({ student, classData, db, navigateTo }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // State for the marking modal
  const [markingAssignment, setMarkingAssignment] = useState(null);
  const [mark, setMark] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchAssignments = async () => {
      if (!student || !student.studentUID) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const assignmentsQuery = query(collection(db, "assignments"), where("studentUID", "==", student.studentUID));
        const assignmentsSnapshot = await getDocs(assignmentsQuery);
        
        const assignmentsWithDetails = await Promise.all(
          assignmentsSnapshot.docs.map(async (assignmentDoc) => {
            const assignmentData = assignmentDoc.data();
            const worksheetRef = doc(db, "worksheets", assignmentData.worksheetId);
            const worksheetSnap = await getDoc(worksheetRef);

            return {
              id: assignmentDoc.id,
              ...assignmentData,
              worksheetTitle: worksheetSnap.exists() ? worksheetSnap.data().title : "Unknown Worksheet",
              worksheetTopic: worksheetSnap.exists() ? worksheetSnap.data().topic : "N/A",
            };
          })
        );
        
        setAssignments(assignmentsWithDetails);
        setError('');
      } catch (err) {
        console.error("Error fetching student assignments:", err);
        setError("Could not load assignments for this student.");
      } finally {
        setLoading(false);
      }
    };

    fetchAssignments();
  }, [student, db]);

  const handleOpenMarkingModal = (assignment) => {
    setMarkingAssignment(assignment);
    setMark(assignment.mark || '');
    setFeedback(assignment.feedback || '');
  };

  const handleCloseMarkingModal = () => {
    setMarkingAssignment(null);
    setMark('');
    setFeedback('');
  };

  const handleSaveMark = async () => {
    if (!markingAssignment) return;
    setIsSaving(true);
    try {
      const assignmentRef = doc(db, "assignments", markingAssignment.id);
      await updateDoc(assignmentRef, {
        mark: mark,
        feedback: feedback,
        status: 'Completed' // Automatically mark as completed
      });

      // Update local state to reflect changes immediately
      setAssignments(prev => prev.map(a => 
        a.id === markingAssignment.id ? { ...a, mark, feedback, status: 'Completed' } : a
      ));

      handleCloseMarkingModal();
    } catch (err) {
      console.error("Error saving mark:", err);
      alert("Failed to save mark. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="bg-white p-8 rounded-lg shadow-md">
        <button onClick={() => navigateTo('class', classData)} className="mb-6 bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">
          &larr; Back to {classData.className}
        </button>
        <h2 className="text-3xl font-bold mb-2">Work for: {student.username}</h2>
        <p className="text-gray-600 mb-6">Viewing all assigned worksheets.</p>

        {loading && <p>Loading assignments...</p>}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && assignments.length === 0 && (
          <p>This student has not been assigned any worksheets yet.</p>
        )}

        {!loading && assignments.length > 0 && (
          <div className="space-y-4">
            {assignments.map(assignment => (
              <div key={assignment.id} className="border rounded-lg p-4 flex justify-between items-center">
                <div>
                  <p className="font-bold text-lg">{assignment.worksheetTitle}</p>
                  <p className="text-sm text-gray-500">{assignment.worksheetTopic}</p>
                </div>
                <div className="flex items-center space-x-4">
                  <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                      assignment.status === 'Completed' ? 'bg-green-100 text-green-800' :
                      assignment.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                  }`}>
                      {assignment.status}
                  </span>
                  <button onClick={() => handleOpenMarkingModal(assignment)} className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">
                    Mark / Feedback
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Marking Modal */}
      {markingAssignment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-2xl">
            <h3 className="text-2xl font-bold mb-4">Marking: {markingAssignment.worksheetTitle}</h3>
            
            <div className="mb-6">
                <h4 className="font-semibold text-gray-700 mb-2">Student's Answers</h4>
                <div className="bg-gray-50 p-4 rounded-md border max-h-60 overflow-y-auto">
                    {Object.keys(markingAssignment.studentWork || {}).length > 0 ? (
                        <pre className="whitespace-pre-wrap font-sans text-sm">
                            {JSON.stringify(markingAssignment.studentWork, null, 2)}
                        </pre>
                    ) : (
                        <p className="text-gray-500">No answers have been saved by the student yet.</p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                    <label htmlFor="mark" className="block text-sm font-medium text-gray-700">Mark / Grade</label>
                    <input type="text" id="mark" value={mark} onChange={e => setMark(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md"/>
                </div>
            </div>

            <div>
                <label htmlFor="feedback" className="block text-sm font-medium text-gray-700">Feedback</label>
                <textarea id="feedback" value={feedback} onChange={e => setFeedback(e.target.value)} rows="4" className="mt-1 block w-full p-2 border border-gray-300 rounded-md"></textarea>
            </div>

            <div className="mt-8 flex justify-end space-x-4">
              <button onClick={handleCloseMarkingModal} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">Cancel</button>
              <button onClick={handleSaveMark} disabled={isSaving} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-green-400">
                {isSaving ? 'Saving...' : 'Save Mark & Feedback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default StudentWorkView;
