import { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

import LandingPage from './components/LandingPage';
import TeacherLogin from './components/TeacherLogin';
import TeacherDashboard from './components/TeacherDashboard';
import ClassView from './components/ClassView';
import ManageWorksheets from './components/ManageWorksheets';
import StudentLogin from './components/StudentLogin';
import StudentDashboard from './components/StudentDashboard';
import StudentWorkView from './components/StudentWorkView';
import WorksheetViewer from './components/WorksheetViewer';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

function App() {
  const [teacherUser, setTeacherUser] = useState(null);
  const [loggedInStudent, setLoggedInStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authState, setAuthState] = useState('landing');
  
  // Teacher navigation state
  const [teacherPage, setTeacherPage] = useState('dashboard');
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  
  // Student navigation state
  const [studentPage, setStudentPage] = useState('dashboard');
  
  // Shared state for viewing worksheets/assignments
  const [selectedWorksheet, setSelectedWorksheet] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && !user.isAnonymous) {
        const teacherRef = doc(db, "teachers", user.uid);
        const teacherSnap = await getDoc(teacherRef);
        if (teacherSnap.exists()) {
          setTeacherUser(user);
          setAuthState('teacher-dashboard');
        } else {
          await signOut(auth);
          setTeacherUser(null);
        }
      } else {
        setTeacherUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    signOut(auth).then(() => {
      setTeacherUser(null);
      setLoggedInStudent(null);
      setAuthState('landing');
      setStudentPage('dashboard');
      setTeacherPage('dashboard');
    });
  };

  const navigateTeacherTo = (page, classData = null, studentData = null, worksheetData = null) => {
    if (classData) setSelectedClass(classData);
    if (studentData) setSelectedStudent(studentData);
    if (worksheetData) setSelectedWorksheet(worksheetData);
    setTeacherPage(page);
  };

  const navigateStudentTo = (page, assignmentData = null) => {
      if (assignmentData) {
        setSelectedAssignment(assignmentData);
        setSelectedWorksheet(assignmentData.worksheet);
      }
      setStudentPage(page);
  };

  if (loading && authState === 'landing') {
    return <div className="flex items-center justify-center h-screen"><div className="text-xl">Loading...</div></div>;
  }
  
  if (loggedInStudent) {
      if (studentPage === 'worksheet-viewer') {
          return <WorksheetViewer assignment={selectedAssignment} db={db} isStudentView={true} navigateTo={navigateStudentTo} returnRoute="dashboard" />
      }
      return <StudentDashboard student={loggedInStudent} setLoggedInStudent={handleLogout} db={db} navigateTo={navigateStudentTo} />
  }

  if (teacherUser) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-md">
          <nav className="container mx-auto px-6 py-3 flex justify-between items-center">
            <h1 className="text-xl font-bold text-gray-800">MGS Teacher Portal</h1>
            <div>
              <button onClick={() => navigateTeacherTo('dashboard')} className={`px-4 py-2 rounded-md text-sm font-medium ${teacherPage === 'dashboard' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'}`}>Dashboard</button>
              <button onClick={() => navigateTeacherTo('worksheets')} className={`ml-4 px-4 py-2 rounded-md text-sm font-medium ${teacherPage === 'worksheets' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'}`}>Manage Worksheets</button>
              <button onClick={handleLogout} className="ml-4 px-4 py-2 bg-red-500 text-white rounded-md text-sm font-medium hover:bg-red-600">Logout</button>
            </div>
          </nav>
        </header>
        <main className="container mx-auto p-6">
          {teacherPage === 'dashboard' && <TeacherDashboard navigateTo={navigateTeacherTo} auth={auth} db={db} />}
          {teacherPage === 'class' && <ClassView classData={selectedClass} navigateTo={navigateTeacherTo} db={db} />}
          {teacherPage === 'worksheets' && <ManageWorksheets db={db} storage={storage} navigateTo={navigateTeacherTo} />}
          {teacherPage === 'student-work' && <StudentWorkView student={selectedStudent} classData={selectedClass} db={db} navigateTo={navigateTeacherTo} />}
          {teacherPage === 'worksheet-viewer' && <WorksheetViewer worksheet={selectedWorksheet} db={db} isStudentView={false} navigateTo={navigateTeacherTo} returnRoute="worksheets" />}
        </main>
      </div>
    );
  }
  
  switch(authState) {
      case 'teacher-login':
          return <TeacherLogin auth={auth} setAuthState={setAuthState} />;
      case 'student-login':
          return <StudentLogin db={db} auth={auth} setLoggedInStudent={setLoggedInStudent} setAuthState={setAuthState} />;
      case 'landing':
      default:
          return <LandingPage setAuthState={setAuthState} />;
  }
}

export default App;
