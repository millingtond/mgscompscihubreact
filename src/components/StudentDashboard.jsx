import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

function StudentDashboard({ student, setLoggedInStudent, db, navigateTo }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        
        if (assignmentsSnapshot.empty) {
            setAssignments([]);
            setLoading(false);
            return;
        }

        const assignmentsWithWorksheetData = await Promise.all(
          assignmentsSnapshot.docs.map(async (assignmentDoc) => {
            const assignmentData = assignmentDoc.data();
            const worksheetRef = doc(db, "worksheets", assignmentData.worksheetId);
            const worksheetSnap = await getDoc(worksheetRef);

            if (worksheetSnap.exists()) {
              return {
                id: assignmentDoc.id,
                ...assignmentData,
                worksheet: { id: worksheetSnap.id, ...worksheetSnap.data() },
              };
            }
            return null;
          })
        );
        
        setAssignments(assignmentsWithWorksheetData.filter(a => a !== null));
        setError('');

      } catch (err) {
        console.error("Error fetching assignments:", err);
        setError("Could not load your assignments. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchAssignments();
  }, [student, db]);

  return (
    <div className="min-h-screen bg-gray-100">
       <header className="bg-white shadow-md">
            <nav className="container mx-auto px-6 py-3 flex justify-between items-center">
              <h1 className="text-xl font-bold text-gray-800">MGS Student Portal</h1>
              <div>
                <span className="text-gray-700 mr-4">Welcome, {student.username}!</span>
                <button
                  onClick={() => setLoggedInStudent(null)}
                  className="px-4 py-2 bg-red-500 text-white rounded-md text-sm font-medium hover:bg-red-600"
                >
                  Logout
                </button>
              </div>
            </nav>
        </header>
        <main className="container mx-auto p-6">
            <h2 className="text-3xl font-bold mb-6">Your Assignments</h2>
            
            {loading && <p>Loading your assignments...</p>}
            {error && <p className="text-red-500">{error}</p>}

            {!loading && assignments.length === 0 && (
                 <div className="bg-white p-8 rounded-lg shadow-md text-center">
                    <p className="text-gray-600">You have no assignments yet. Check back later!</p>
                </div>
            )}

            {!loading && assignments.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {assignments.map(assignment => (
                        <div key={assignment.id} className="bg-white p-6 rounded-lg shadow-md flex flex-col justify-between">
                            <div>
                                <p className="text-sm font-semibold text-blue-600">{assignment.worksheet.topic}</p>
                                <h3 className="text-xl font-bold mt-1">{assignment.worksheet.title}</h3>
                                <div className="mt-4 flex items-center">
                                    <span className="text-sm font-medium text-gray-600 mr-2">Status:</span>
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                        assignment.status === 'Completed' ? 'bg-green-100 text-green-800' :
                                        assignment.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-gray-100 text-gray-800'
                                    }`}>
                                        {assignment.status}
                                    </span>
                                </div>
                            </div>
                             <div className="mt-6">
                                <button 
                                    onClick={() => navigateTo('worksheet-viewer', assignment)}
                                    className="w-full block text-center bg-green-600 text-white font-bold py-2 px-4 rounded hover:bg-green-700"
                                >
                                    {/* FIX: Change button text based on status */}
                                    {assignment.status === 'In Progress' ? 'Continue Worksheet' : 'Start Worksheet'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </main>
    </div>
  );
}

export default StudentDashboard;
