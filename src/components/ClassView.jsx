import { useState, useEffect } from 'react';
import { doc, collection, query, where, getDocs, addDoc, deleteDoc, writeBatch, orderBy, updateDoc, serverTimestamp } from 'firebase/firestore';

function ClassView({ classData, navigateTo, db, auth }) { // Add auth to props
  const [students, setStudents] = useState([]);
  const [allWorksheets, setAllWorksheets] = useState([]);
  const [assignedWorksheets, setAssignedWorksheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // --- NEW: State for Announcements ---
  const [announcementContent, setAnnouncementContent] = useState('');
  const [classAnnouncements, setClassAnnouncements] = useState([]);
  const [isPosting, setIsPosting] = useState(false);


  const [numStudents, setNumStudents] = useState(1);
  const [newCredentials, setNewCredentials] = useState('');
  
  const [selectedWorksheetId, setSelectedWorksheetId] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignmentFeedback, setAssignmentFeedback] = useState('');

  const [managingStudentId, setManagingStudentId] = useState(null);
  const [resetPasswordInfo, setResetPasswordInfo] = useState(null);

  const [adjectives] = useState(['clever', 'brave', 'quiet', 'bright', 'happy', 'swift', 'calm', 'eager', 'jolly', 'kind', 'proud', 'silly', 'witty', 'zany', 'gentle', 'sharp', 'bold', 'daring', 'loyal', 'wise']);
  const [nouns] = useState(['lion', 'tiger', 'eagle', 'shark', 'robot', 'ninja', 'comet', 'planet', 'star', 'ocean', 'river', 'mountain', 'forest', 'castle', 'dragon', 'wizard', 'cyborg', 'rocket', 'kernel', 'pixel']);

  const generatePassword = (length = 6) => {
    const charset = "abcdefghijklmnopqrstuvwxyz0123456789";
    let password = "";
    for (let i = 0; i < length; ++i) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset.charAt(randomIndex);
    }
    return password;
  };

  const sha256 = async (str) => {
      const textAsBuffer = new TextEncoder().encode(str);
      const hashBuffer = await crypto.subtle.digest('SHA-256', textAsBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!classData) return;
      try {
        setLoading(true);
        // --- Fetch students, worksheets, and assignments (existing logic) ---
        const studentsQuery = query(collection(db, "students"), where("classId", "==", classData.id));
        const studentsSnapshot = await getDocs(studentsQuery);
        const studentsList = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setStudents(studentsList);

        const worksheetsQuery = query(collection(db, "worksheets"), orderBy("title"));
        const worksheetsSnapshot = await getDocs(worksheetsQuery);
        const worksheetsList = worksheetsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllWorksheets(worksheetsList);
        if (worksheetsList.length > 0) {
            setSelectedWorksheetId(worksheetsList[0].id);
        }

        const classAssignmentsQuery = query(collection(db, "assignments"), where("classId", "==", classData.id));
        const classAssignmentsSnapshot = await getDocs(classAssignmentsQuery);
        const assignedIds = [...new Set(classAssignmentsSnapshot.docs.map(doc => doc.data().worksheetId))];
        const assignedWs = worksheetsList.filter(ws => assignedIds.includes(ws.id));
        setAssignedWorksheets(assignedWs);

        // --- NEW: Fetch announcements for the class ---
        const announcementsQuery = query(collection(db, "announcements"), where("classId", "==", classData.id), orderBy("createdAt", "desc"));
        const announcementsSnapshot = await getDocs(announcementsQuery);
        const announcementsList = announcementsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setClassAnnouncements(announcementsList);

        setError('');
      } catch (err) {
        console.error("Error fetching data: ", err);
        setError("Failed to fetch class data. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [classData, db]);

  // --- NEW: Function to handle posting an announcement ---
  const handlePostAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcementContent.trim()) {
      setError("Announcement content cannot be empty.");
      return;
    }
    setIsPosting(true);
    setError('');
    try {
      const newAnnouncement = {
        content: announcementContent,
        classId: classData.id,
        teacherId: auth.currentUser.uid,
        createdAt: serverTimestamp() // Use server timestamp for consistency
      };
      const docRef = await addDoc(collection(db, "announcements"), newAnnouncement);
      // Optimistically update UI
      setClassAnnouncements([{ id: docRef.id, ...newAnnouncement, createdAt: { toDate: () => new Date() } }, ...classAnnouncements]);
      setAnnouncementContent('');
    } catch (err) {
      console.error("Error posting announcement: ", err);
      setError("Failed to post announcement. Please try again.");
    } finally {
      setIsPosting(false);
    }
  };

  // --- NEW: Function to handle deleting an announcement ---
  const handleDeleteAnnouncement = async (announcementId) => {
    if (!window.confirm("Are you sure you want to delete this announcement?")) return;
    try {
      await deleteDoc(doc(db, "announcements", announcementId));
      setClassAnnouncements(prev => prev.filter(ann => ann.id !== announcementId));
    } catch (err) {
      console.error("Error deleting announcement: ", err);
      setError("Failed to delete announcement.");
    }
  };

  const handleAddStudents = async (e) => {
    e.preventDefault();
    setError('');
    if (students.length + numStudents > 30) {
        setError(`This class has ${students.length} students. Adding ${numStudents} would exceed the class limit of 30.`);
        return;
    }
    let credentialsOutput = 'Username,Password\n';
    const studentsCollectionRef = collection(db, "students");
    const newStudentPromises = [];
    for (let i = 0; i < numStudents; i++) {
        const username = `${adjectives[Math.floor(Math.random() * adjectives.length)]}-${nouns[Math.floor(Math.random() * nouns.length)]}-${Math.floor(100 + Math.random() * 900)}`;
        const plainPassword = generatePassword();
        const hashedPassword = await sha256(plainPassword);
        const studentUID = `student-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const studentData = { classId: classData.id, username, password: hashedPassword, studentUID, createdAt: new Date() };
        newStudentPromises.push(addDoc(studentsCollectionRef, studentData));
        credentialsOutput += `${username},${plainPassword}\n`;
    }
    try {
        await Promise.all(newStudentPromises);
        setNewCredentials(credentialsOutput);
        const studentsQuery = query(collection(db, "students"), where("classId", "==", classData.id));
        const querySnapshot = await getDocs(studentsQuery);
        setStudents(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
        console.error("Error creating new students:", err);
        setError("Failed to create new students.");
    }
  };
  
  const handleAssignWorksheet = async () => {
      if (!selectedWorksheetId || selectedStudentIds.length === 0) {
          setAssignmentFeedback("Please select a worksheet and at least one student.");
          return;
      }
      setIsAssigning(true);
      setAssignmentFeedback('');
      try {
          const assignmentsRef = collection(db, "assignments");
          const batch = writeBatch(db);
          let assignmentsCreated = 0;
          for (const studentId of selectedStudentIds) {
              const student = students.find(s => s.id === studentId);
              if (!student) continue;
              const q = query(assignmentsRef, where("studentUID", "==", student.studentUID), where("worksheetId", "==", selectedWorksheetId));
              const existingAssignment = await getDocs(q);
              if (existingAssignment.empty) {
                  const newAssignmentRef = doc(assignmentsRef);
                  batch.set(newAssignmentRef, { classId: classData.id, studentUID: student.studentUID, worksheetId: selectedWorksheetId, status: 'Not Started', mark: '', feedback: '', studentWork: {}, assignedAt: new Date() });
                  assignmentsCreated++;
              }
          }
          if (assignmentsCreated > 0) {
              await batch.commit();
              setAssignmentFeedback(`${assignmentsCreated} new assignment(s) created successfully!`);
              const newlyAssigned = allWorksheets.find(ws => ws.id === selectedWorksheetId);
              if (newlyAssigned && !assignedWorksheets.some(ws => ws.id === selectedWorksheetId)) {
                  setAssignedWorksheets(prev => [...prev, newlyAssigned]);
              }
          } else {
              setAssignmentFeedback("These assignments already exist for the selected students.");
          }
          setSelectedStudentIds([]);
      } catch (err) {
          console.error("Error assigning worksheets:", err);
          setAssignmentFeedback("An error occurred. Could not create assignments.");
      } finally {
          setIsAssigning(false);
      }
  };
  
  const handleStudentSelection = (studentId) => {
      setSelectedStudentIds(prev => prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]);
  };

  const handleSelectAllStudents = (e) => {
      if (e.target.checked) {
          setSelectedStudentIds(students.map(s => s.id));
      } else {
          setSelectedStudentIds([]);
      }
  };

  const handleManageClick = (studentId) => {
    setManagingStudentId(prevId => (prevId === studentId ? null : studentId));
    setResetPasswordInfo(null);
  };

  const handleResetPassword = async (studentToReset) => {
      const newPassword = generatePassword();
      const newHashedPassword = await sha256(newPassword);
      try {
          const studentRef = doc(db, "students", studentToReset.id);
          await updateDoc(studentRef, { password: newHashedPassword });
          setResetPasswordInfo({ username: studentToReset.username, password: newPassword });
      } catch (err) {
          console.error("Error resetting password:", err);
          alert("Failed to reset password. Please try again.");
      }
  };

  const handleDeleteStudent = async (studentToDelete) => {
      if (window.confirm(`Are you sure you want to delete ${studentToDelete.username}? This will also delete all of their assignment data and cannot be undone.`)) {
          try {
              const assignmentsRef = collection(db, "assignments");
              const q = query(assignmentsRef, where("studentUID", "==", studentToDelete.studentUID));
              const assignmentsSnapshot = await getDocs(q);
              const batch = writeBatch(db);
              assignmentsSnapshot.forEach(doc => batch.delete(doc.ref));
              await batch.commit();
              await deleteDoc(doc(db, "students", studentToDelete.id));
              setStudents(prev => prev.filter(s => s.id !== studentToDelete.id));
          } catch (err) {
              console.error("Error deleting student and their assignments:", err);
              alert("An error occurred while deleting the student.");
          }
      }
  };

  const handleDeleteAllAssignments = async (worksheetId, worksheetTitle) => {
    if (window.confirm(`Are you sure you want to delete all assignments for "${worksheetTitle}" from this class? This action cannot be undone.`)) {
        try {
            const q = query(collection(db, "assignments"), 
                where("classId", "==", classData.id), 
                where("worksheetId", "==", worksheetId)
            );
            const assignmentsSnapshot = await getDocs(q);
            if (assignmentsSnapshot.empty) {
                alert("No assignments found to delete.");
                return;
            }
            const batch = writeBatch(db);
            assignmentsSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            setAssignedWorksheets(prev => prev.filter(ws => ws.id !== worksheetId));
            alert(`All assignments for "${worksheetTitle}" have been deleted.`);
        } catch (err) {
            console.error("Error deleting all assignments:", err);
            alert("An error occurred while deleting the assignments.");
        }
    }
  };

  if (loading) return <div>Loading class details...</div>;

  return (
    <div className="bg-white p-8 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-6">
            <button onClick={() => navigateTo('dashboard')} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">&larr; Back to Dashboard</button>
            <button onClick={() => navigateTo('markbook', classData)} className="bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600">View Markbook</button>
        </div>
      <h2 className="text-3xl font-bold mb-2">{classData.className}</h2>
      <p className="text-gray-600 mb-6">Year {classData.yearGroup}</p>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h3 className="text-2xl font-semibold mb-4">Enrolled Students ({students.length}/30)</h3>
           <div className="space-y-2">
            {students.length > 0 ? (
              students.map(student => (
                <div key={student.id} className="bg-gray-50 p-3 rounded-md transition-all duration-300">
                  <div className="flex justify-between items-center">
                    <span>{student.username}</span>
                    <div className="space-x-2">
                        <button onClick={() => navigateTo('student-work', classData, student)} className="text-sm text-blue-500 hover:underline">View Work</button>
                        <button onClick={() => handleManageClick(student.id)} className="text-sm bg-gray-200 px-2 py-1 rounded hover:bg-gray-300">Manage</button>
                    </div>
                  </div>
                  {managingStudentId === student.id && (
                    <div className="mt-4 pt-3 border-t">
                        <h4 className="font-semibold text-sm mb-2">Manage {student.username}</h4>
                        {resetPasswordInfo && resetPasswordInfo.username === student.username && (
                            <div className="bg-yellow-100 p-2 rounded-md mb-2 text-sm">
                                New Password: <strong className="font-mono">{resetPasswordInfo.password}</strong>
                            </div>
                        )}
                        <div className="flex space-x-2">
                            <button onClick={() => handleResetPassword(student)} className="bg-yellow-500 text-white px-3 py-1 rounded-md text-sm hover:bg-yellow-600">Reset Password</button>
                            <button onClick={() => handleDeleteStudent(student)} className="bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600">Delete Student</button>
                        </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p>No students enrolled yet.</p>
            )}
          </div>

          <div className="bg-gray-50 p-4 rounded-lg mt-6">
            <h4 className="font-semibold mb-2">Add New Students</h4>
            <form onSubmit={handleAddStudents}>
              <label htmlFor="numStudents" className="block text-sm font-medium text-gray-700">Number of students:</label>
              <div className="mt-1 flex items-center">
                <input type="number" id="numStudents" value={numStudents} onChange={(e) => setNumStudents(parseInt(e.target.value, 10))} min="1" max="30" className="p-2 border rounded-md w-24"/>
                <button type="submit" className="ml-4 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">Generate</button>
              </div>
            </form>
            {newCredentials && (
              <div className="mt-4">
                <h4 className="font-bold">New Credentials (Copy now):</h4>
                <textarea readOnly className="w-full h-40 p-2 mt-2 bg-gray-100 border rounded-md font-mono text-sm" value={newCredentials}></textarea>
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-2xl font-semibold mb-4">Assign a Worksheet</h3>
          <div className="bg-gray-50 p-4 rounded-lg space-y-4">
              <div>
                  <label htmlFor="worksheet-select" className="block text-sm font-medium text-gray-700">Select Worksheet</label>
                  <select id="worksheet-select" value={selectedWorksheetId} onChange={e => setSelectedWorksheetId(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md bg-white">
                      {allWorksheets.length > 0 ? allWorksheets.map(ws => (
                          <option key={ws.id} value={ws.id}>{ws.title}</option>
                      )) : <option disabled>No worksheets available</option>}
                  </select>
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700">Select Students</label>
                  <div className="mt-2 border rounded-md p-2 h-48 overflow-y-auto bg-white">
                      <div className="flex items-center border-b pb-2 mb-2">
                          <input type="checkbox" id="select-all" onChange={handleSelectAllStudents} checked={selectedStudentIds.length === students.length && students.length > 0}/>
                          <label htmlFor="select-all" className="ml-2 font-semibold">Select All</label>
                      </div>
                      {students.map(student => (
                          <div key={student.id} className="flex items-center">
                              <input type="checkbox" id={`student-${student.id}`} checked={selectedStudentIds.includes(student.id)} onChange={() => handleStudentSelection(student.id)}/>
                              <label htmlFor={`student-${student.id}`} className="ml-2">{student.username}</label>
                          </div>
                      ))}
                  </div>
              </div>
              <button onClick={handleAssignWorksheet} disabled={isAssigning} className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-green-400">
                  {isAssigning ? 'Assigning...' : `Assign to ${selectedStudentIds.length} Student(s)`}
              </button>
              {assignmentFeedback && <p className="text-sm text-center text-gray-600 mt-2">{assignmentFeedback}</p>}
          </div>

          {/* --- NEW: Announcements Section --- */}
          <div className="mt-8">
            <h3 className="text-2xl font-semibold mb-4">Class Announcements</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
                <form onSubmit={handlePostAnnouncement}>
                    <label htmlFor="announcement" className="block text-sm font-medium text-gray-700">New Announcement</label>
                    <textarea 
                        id="announcement"
                        rows="3"
                        value={announcementContent}
                        onChange={(e) => setAnnouncementContent(e.target.value)}
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                        placeholder="Inform your students about upcoming tests, deadlines, or other news..."
                    ></textarea>
                    <button type="submit" disabled={isPosting} className="mt-2 w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-400">
                        {isPosting ? 'Posting...' : 'Post Announcement'}
                    </button>
                </form>

                <div className="mt-6">
                    <h4 className="font-semibold text-gray-800">Recent Announcements</h4>
                    <div className="space-y-3 mt-2">
                        {classAnnouncements.length > 0 ? (
                            classAnnouncements.map(ann => (
                                <div key={ann.id} className="bg-white p-3 rounded-lg shadow-sm">
                                    <p className="text-gray-800">{ann.content}</p>
                                    <div className="flex justify-between items-center mt-2">
                                        <p className="text-xs text-gray-400">
                                            Posted on: {ann.createdAt?.toDate().toLocaleDateString()}
                                        </p>
                                        <button 
                                            onClick={() => handleDeleteAnnouncement(ann.id)}
                                            className="text-red-500 hover:underline text-xs font-semibold"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 text-sm mt-2">No announcements have been posted for this class yet.</p>
                        )}
                    </div>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ClassView;