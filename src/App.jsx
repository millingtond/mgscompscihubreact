import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import TeacherLogin from './components/TeacherLogin.jsx';
import TeacherDashboard from './components/TeacherDashboard.jsx'; 
import ClassView from './components/ClassView.jsx';
import ManageWorksheets from './components/ManageWorksheets.jsx';

// Initialize Firebase in your main App file. This only needs to be done once.
const firebaseConfig = {
    apiKey: "AIzaSyB5J6kLg1N8Sul_zE_wHo1OiuDDwsuix2A",
    authDomain: "mgscompsci-dda86.firebaseapp.com",
    projectId: "mgscompsci-dda86",
    storageBucket: "mgscompsci-dda86.firebasestorage.app",
    messagingSenderId: "850907435330",
    appId: "1:850907435330:web:735c3d1a5e4a483a9238db"
};
initializeApp(firebaseConfig);

export default function App() {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'class', or 'worksheets'
    const [selectedClassId, setSelectedClassId] = useState(null);
    const auth = getAuth();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                setCurrentView('dashboard');
                setSelectedClassId(null);
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleLogout = async () => {
        await signOut(auth);
    };

    const handleSelectClass = (classId) => {
        setSelectedClassId(classId);
        setCurrentView('class');
    };

    const handleBackToDashboard = () => {
        setSelectedClassId(null);
        setCurrentView('dashboard');
    };
    
    const handleGoToWorksheets = () => {
        setCurrentView('worksheets');
    };

    if (isLoading) {
        return <div className="flex items-center justify-center min-h-screen">Loading Application...</div>;
    }

    const renderContent = () => {
        if (!user) {
            return <TeacherLogin onLoginSuccess={() => setUser(auth.currentUser)} />;
        }

        switch (currentView) {
            case 'class':
                return <ClassView classId={selectedClassId} onBack={handleBackToDashboard} user={user} />;
            case 'worksheets':
                return <ManageWorksheets onBack={handleBackToDashboard} />;
            case 'dashboard':
            default:
                return <TeacherDashboard user={user} onLogout={handleLogout} onSelectClass={handleSelectClass} onGoToWorksheets={handleGoToWorksheets} />;
        }
    };

    return <div>{renderContent()}</div>;
}
