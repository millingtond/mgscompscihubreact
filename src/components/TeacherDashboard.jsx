import React, { useState, useEffect, useCallback } from 'react';
import { getFirestore, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';

const CreateClassModal = ({ isOpen, onClose, onClassCreate }) => {
    const [className, setClassName] = useState('');
    const [yearGroup, setYearGroup] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!className || !yearGroup) {
            alert("Please fill in all fields.");
            return;
        }
        setIsCreating(true);
        await onClassCreate({ className, yearGroup: parseInt(yearGroup) });
        setIsCreating(false);
        setClassName('');
        setYearGroup('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                <h3 className="text-2xl font-bold text-center mb-6">Create a New Class</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="modalClassName" className="text-sm font-medium text-gray-700 text-left block">Class Name</label>
                        <input type="text" id="modalClassName" value={className} onChange={(e) => setClassName(e.target.value)} required className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm" placeholder="e.g., 10A/Cs1" />
                    </div>
                    <div>
                        <label htmlFor="modalYearGroup" className="text-sm font-medium text-gray-700 text-left block">Year Group</label>
                        <input type="number" id="modalYearGroup" value={yearGroup} onChange={(e) => setYearGroup(e.target.value)} required className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm" placeholder="e.g., 10" />
                    </div>
                    <div className="flex items-center justify-end space-x-4 pt-4">
                        <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" disabled={isCreating} className="py-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400">
                            {isCreating ? 'Creating...' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default function TeacherDashboard({ user, onLogout, onSelectClass, onGoToWorksheets }) {
    const [classes, setClasses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchClasses = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const db = getFirestore();
            const classesRef = collection(db, "classes");
            const q = query(classesRef, where("teacherId", "==", user.uid));
            const querySnapshot = await getDocs(q);
            const fetchedClasses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setClasses(fetchedClasses);
        } catch (err) {
            setError("Could not fetch classes. Please check your Firestore rules and ensure you are connected to the internet.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [user.uid]);

    useEffect(() => {
        fetchClasses();
    }, [fetchClasses]);

    const handleCreateClass = async (classData) => {
        try {
            const db = getFirestore();
            await addDoc(collection(db, "classes"), {
                ...classData,
                teacherId: user.uid,
                createdAt: serverTimestamp()
            });
            fetchClasses();
        } catch (err) {
            setError("Failed to create class.");
            console.error(err);
        }
    };

    return (
        <div className="bg-gray-50 min-h-screen">
            <nav className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <h1 className="text-2xl font-bold text-indigo-700">Teacher Dashboard</h1>
                        <div className="flex items-center">
                            <span className="text-sm text-gray-600 mr-4 hidden sm:block">{user.email}</span>
                            <button onClick={onLogout} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg text-sm">
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </nav>
            <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                    <h2 className="text-3xl font-semibold text-gray-800">Your Classes</h2>
                    <div className="flex space-x-4">
                        <button onClick={onGoToWorksheets} className="bg-white border border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-bold py-2 px-4 rounded-lg shadow-sm transition-colors">
                            Manage Worksheets
                        </button>
                        <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm">
                            + Create New Class
                        </button>
                    </div>
                </div>
                {error && <p className="text-red-500 bg-red-100 p-3 rounded-md text-center">{error}</p>}
                <div className="mt-6">
                    {isLoading ? <p>Loading classes...</p> : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {classes.length > 0 ? classes.map(cls => (
                                <button key={cls.id} onClick={() => onSelectClass(cls.id)} className="block p-6 bg-white rounded-lg border shadow-md hover:bg-gray-100 transition-all text-left">
                                    <h5 className="mb-2 text-2xl font-bold text-gray-900">{cls.className}</h5>
                                    <p className="font-normal text-gray-700">Year {cls.yearGroup}</p>
                                </button>
                            )) : (
                                <div className="col-span-full text-center p-10 bg-white rounded-lg shadow">
                                    <p className="text-gray-600">You haven't created any classes yet.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
            <CreateClassModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onClassCreate={handleCreateClass} />
        </div>
    );
}
