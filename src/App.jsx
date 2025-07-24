import { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Component Imports
import LandingPage from './components/LandingPage';
import TeacherLogin from './components/TeacherLogin';
import TeacherDashboard from './components/TeacherDashboard';
import ClassView from './components/ClassView';
import ManageWorksheets from './components/ManageWorksheets';
import StudentLogin from './components/StudentLogin';
import StudentDashboard from './components/StudentDashboard';
import StudentWorkView from './components/StudentWorkView';
import WorksheetViewer from './components/WorksheetViewer';
import MarkingView from './components/MarkingView';
import MarkbookView from './components/MarkbookView';
// --- NEW --- Import the new ProgressDashboard component
import ProgressDashboard from './components/ProgressDashboard';


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
  
  const [teacherPage, setTeacherPage] = useState('dashboard');
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  
  // This state now controls which view the student sees
  const [studentPage, setStudentPage] = useState('dashboard');
  
  const [selectedAssignment, setSelectedAssignment] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        const idTokenResult = await user.getIdTokenResult();
        
        if (idTokenResult.claims.studentUID) {
          const studentRef = doc(db, "students", user.uid);
          const studentSnap = await getDoc(studentRef);
          if (studentSnap.exists()) {
            setLoggedInStudent({ uid: user.uid, ...studentSnap.data() });
            setTeacherUser(null);
            setStudentPage('dashboard'); // Default to dashboard on login
          } else {
            await signOut(auth);
          }
        } else {
          const teacherRef = doc(db, "teachers", user.uid);
          const teacherSnap = await getDoc(teacherRef);
          if (teacherSnap.exists()) {
            setTeacherUser(user);
            setLoggedInStudent(null);
            setTeacherPage('dashboard'); // Default to dashboard on login
          } else {
            await signOut(auth);
          }
        }
      } else {
        setTeacherUser(null);
        setLoggedInStudent(null);
        setAuthState('landing');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    signOut(auth);
  };

  const navigateTeacherTo = (page, classData = null, studentData = null, assignmentData = null) => {
    if (classData) setSelectedClass(classData);
    if (studentData) setSelectedStudent(studentData);
    if (assignmentData) setSelectedAssignment(assignmentData);
    setTeacherPage(page);
  };

  // Updated navigation function for students
  const navigateStudentTo = (page, assignmentData = null) => {
    if (assignmentData) {
      setSelectedAssignment(assignmentData);
    }
    setStudentPage(page);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><div className="text-xl">Loading...</div></div>;
  }
  
  // --- UPDATED --- Logic to render different pages for a logged-in student
  if (loggedInStudent) {
    switch(studentPage) {
      case 'worksheet-viewer':
        return <WorksheetViewer assignment={selectedAssignment} db={db} navigateTo={navigateStudentTo} returnRoute="dashboard" app={app} />;
      case 'progress':
        return <ProgressDashboard app={app} navigateTo={navigateStudentTo} />;
      case 'dashboard':
      default:
        return <StudentDashboard student={loggedInStudent} handleLogout={handleLogout} db={db} navigateTo={navigateStudentTo} app={app} />;
    }
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
          {teacherPage === 'class' && <ClassView classData={selectedClass} navigateTo={navigateTeacherTo} db={db} auth={auth} />}
          {teacherPage === 'worksheets' && <ManageWorksheets db={db} storage={storage} navigateTo={navigateTeacherTo} />}
          {teacherPage === 'student-work' && <StudentWorkView student={selectedStudent} classData={selectedClass} db={db} navigateTo={navigateTeacherTo} />}
          {teacherPage === 'marking' && <MarkingView assignment={selectedAssignment} classData={selectedClass} db={db} navigateTo={navigateTeacherTo} />}
          {teacherPage === 'markbook' && <MarkbookView classData={selectedClass} db={db} navigateTo={navigateTeacherTo} />}
          {teacherPage === 'worksheet-viewer' && <WorksheetViewer assignment={selectedAssignment} db={db} navigateTo={navigateTeacherTo} returnRoute="worksheets" app={app} />}
        </main>
      </div>
    );
  }
  
  switch(authState) {
    case 'teacher-login':
      return <TeacherLogin app={app} setAuthState={setAuthState} />;
    case 'student-login':
      return <StudentLogin setAuthState={setAuthState} app={app} />;
    case 'landing':
    default:
      return <LandingPage setAuthState={setAuthState} />;
  }
}

export default App;
