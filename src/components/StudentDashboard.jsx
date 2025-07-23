import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, orderBy, limit } from 'firebase/firestore';

function StudentDashboard({ student, setLoggedInStudent, db, navigateTo }) {
  const [assignments, setAssignments] = useState([]);
  const [announcements, setAnnouncements] = useState([]); // --- NEW: State for announcements
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!student || !student.studentUID) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);

        // --- Fetch assignments (existing logic) ---
        const assignmentsQuery = query(collection(db, "assignments"), where("studentUID", "==", student.studentUID));
        const assignmentsSnapshot = await getDocs(assignmentsQuery);
        
        let assignmentsWithWorksheetData = [];
        if (!assignmentsSnapshot.empty) {
            assignmentsWithWorksheetData = await Promise.all(
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
        }
        setAssignments(assignmentsWithWorksheetData.filter(a => a !== null));

        // --- NEW: Fetch recent announcements for the student's class ---
        if (student.classId) {
            const announcementsQuery = query(
                collection(db, "announcements"), 
                where("classId", "==", student.classId),
                orderBy("createdAt", "desc"),
                limit(5) // Get the 5 most recent announcements
            );
            const announcementsSnapshot = await getDocs(announcementsQuery);
            const announcementsList = announcementsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAnnouncements(announcementsList);
        }

        setError('');
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        setError("Could not load your dashboard. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [student, db]);

  const getButtonInfo = (status) => {
    switch (status) {
      case 'Completed':
        return { text: 'View Feedback', style: 'bg-blue-600 hover:bg-blue-700' };
      case 'Handed In':
        return { text: 'Awaiting Mark', style: 'bg-purple-600 hover:bg-purple-700' };
      case 'In Progress':
        return { text: 'Continue Worksheet', style: 'bg-yellow-600 hover:bg-yellow-700' };
      default:
        return { text: 'Start Worksheet', style: 'bg-green-600 hover:bg-green-700' };
    }
  };

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
            
            {loading && <p>Loading your dashboard...</p>}
            {error && <p className="text-red-500">{error}</p>}

            {/* --- NEW: Announcements Section --- */}
            {!loading && (
                 <div className="mb-8">
                    <h2 className="text-3xl font-bold mb-4">Class Announcements</h2>
                    <div className="bg-white p-6 rounded-lg shadow-md space-y-4">
                        {announcements.length > 0 ? (
                            announcements.map(ann => (
                                <div key={ann.id} className="border-b pb-3 last:border-b-0">
                                    <p className="text-gray-800">{ann.content}</p>
                                    <p className="text-xs text-gray-500 mt-2">
                                        Posted: {ann.createdAt?.toDate().toLocaleDateString()}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-600">No recent announcements from your teacher.</p>
                        )}
                    </div>
                </div>
            )}

            <h2 className="text-3xl font-bold mb-6">Your Assignments</h2>

            {!loading && assignments.length === 0 && (
                 <div className="bg-white p-8 rounded-lg shadow-md text-center">
                    <p className="text-gray-600">You have no assignments yet. Check back later!</p>
                </div>
            )}

            {!loading && assignments.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {assignments.map(assignment => {
                        const buttonInfo = getButtonInfo(assignment.status);
                        return (
                            <div key={assignment.id} className="bg-white p-6 rounded-lg shadow-md flex flex-col justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-blue-600">{assignment.worksheet.topic}</p>
                                    <h3 className="text-xl font-bold mt-1">{assignment.worksheet.title}</h3>
                                    <div className="mt-4 flex items-center">
                                        <span className="text-sm font-medium text-gray-600 mr-2">Status:</span>
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                            assignment.status === 'Completed' ? 'bg-green-100 text-green-800' :
                                            assignment.status === 'Handed In' ? 'bg-purple-100 text-purple-800' :
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
                                        className={`w-full block text-center text-white font-bold py-2 px-4 rounded ${buttonInfo.style}`}
                                    >
                                        {buttonInfo.text}
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </main>
    </div>
  );
}

export default StudentDashboard;