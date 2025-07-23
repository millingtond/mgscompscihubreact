import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';

function StudentWorkView({ student, classData, db, navigateTo }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

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

  const handleOpenMarkingView = (assignment) => {
    navigateTo('marking', classData, student, null, assignment);
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (!assignmentId) return;
    try {
        await deleteDoc(doc(db, 'assignments', assignmentId));
        setAssignments(prev => prev.filter(a => a.id !== assignmentId));
    } catch (error) {
        console.error("Error deleting assignment: ", error);
        alert("Failed to delete assignment. Please try again.");
    }
    setShowDeleteConfirm(null);
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
                      assignment.status === 'Handed In' ? 'bg-purple-100 text-purple-800' :
                      assignment.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                  }`}>
                      {assignment.status}
                  </span>
                  <button onClick={() => handleOpenMarkingView(assignment)} className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">
                    Mark / Feedback
                  </button>
                  <button onClick={() => setShowDeleteConfirm(assignment)} className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
                <h3 className="text-xl font-bold mb-4">Confirm Deletion</h3>
                <p className="text-gray-600 mb-6">
                    Are you sure you want to delete the assignment "{showDeleteConfirm.worksheetTitle}"? This action cannot be undone.
                </p>
                <div className="flex justify-end space-x-4">
                    <button onClick={() => setShowDeleteConfirm(null)} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">
                        Cancel
                    </button>
                    <button onClick={() => handleDeleteAssignment(showDeleteConfirm.id)} className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700">
                        Delete
                    </button>
                </div>
            </div>
        </div>
      )}
    </>
  );
}

export default StudentWorkView;
