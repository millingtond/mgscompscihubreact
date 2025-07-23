import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

function MarkbookView({ classData, db, navigateTo }) {
  const [students, setStudents] = useState([]);
  const [worksheets, setWorksheets] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!classData) {
        setError("No class data provided.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        // 1. Fetch all students in the class
        const studentsQuery = query(collection(db, "students"), where("classId", "==", classData.id), orderBy("username"));
        const studentsSnapshot = await getDocs(studentsQuery);
        const studentsList = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setStudents(studentsList);

        // 2. Fetch all assignments for the class
        const assignmentsQuery = query(collection(db, "assignments"), where("classId", "==", classData.id));
        const assignmentsSnapshot = await getDocs(assignmentsQuery);
        const assignmentsList = assignmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAssignments(assignmentsList);

        // 3. Determine the unique worksheets assigned to this class
        if (assignmentsList.length > 0) {
            const worksheetIds = [...new Set(assignmentsList.map(a => a.worksheetId))];
            const worksheetsQuery = query(collection(db, "worksheets"), where("__name__", "in", worksheetIds));
            const worksheetsSnapshot = await getDocs(worksheetsQuery);
            const worksheetsList = worksheetsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setWorksheets(worksheetsList);
        }
        
        setError('');
      } catch (err) {
        console.error("Error fetching markbook data:", err);
        setError("Failed to load markbook data. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [classData, db]);

  const getAssignmentForStudent = (student, worksheetId) => {
    return assignments.find(a => a.studentUID === student.studentUID && a.worksheetId === worksheetId);
  };

  // --- UPDATED: This function now returns colors for grades as well ---
  const getStatusColor = (status, grade) => {
    if (status === 'Completed' && grade) {
        switch (grade) {
            case 'O': return 'bg-cyan-100 text-cyan-800';
            case 'E': return 'bg-green-100 text-green-800';
            case 'G': return 'bg-blue-100 text-blue-800';
            case 'RI': return 'bg-yellow-100 text-yellow-800';
            case 'U': return 'bg-red-100 text-red-800';
            default: return 'bg-green-100 text-green-800'; // Default for completed with non-standard mark
        }
    }
    switch (status) {
        case 'Handed In': return 'bg-purple-100 text-purple-800';
        case 'In Progress': return 'bg-yellow-100 text-yellow-800';
        default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading Markbook...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow-md">
      <button onClick={() => navigateTo('class', classData)} className="mb-6 bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">
        &larr; Back to {classData.className}
      </button>
      <h2 className="text-3xl font-bold mb-2">Markbook for {classData.className}</h2>
      <p className="text-gray-600 mb-6">An overview of student progress and grades.</p>

      {students.length === 0 || worksheets.length === 0 ? (
        <p>No assignments have been given to this class yet. Assign a worksheet to see the markbook.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="sticky left-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Student
                </th>
                {worksheets.map(ws => (
                  <th key={ws.id} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {ws.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {students.map(student => (
                <tr key={student.id}>
                  <td className="sticky left-0 bg-white px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {student.username}
                  </td>
                  {worksheets.map(ws => {
                    const assignment = getAssignmentForStudent(student, ws.id);
                    return (
                      <td key={ws.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {assignment ? (
                          <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(assignment.status, assignment.mark)}`}>
                            {assignment.status === 'Completed' && assignment.mark ? 
                                `Grade: ${assignment.mark}` : 
                                assignment.status
                            }
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default MarkbookView;
