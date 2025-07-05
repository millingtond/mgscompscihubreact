import React, { useState, useEffect, useCallback } from 'react';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, writeBatch, deleteDoc, orderBy, onSnapshot } from 'firebase/firestore';

const db = getFirestore();
const appId = 'default-app-id';

const sha256 = async (string) => {
    const utf8 = new TextEncoder().encode(string);
    const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const ActionCard = ({ title, children }) => (
    <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold mb-4">{title}</h3>
        {children}
    </div>
);

const StudentList = ({ students, onDeleteStudent }) => (
    <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
                <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Password</th>
                    <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {students.length === 0 ? (
                    <tr><td colSpan="3" className="px-6 py-4 text-center text-gray-500">No students found.</td></tr>
                ) : (
                    students.map(student => (
                        <tr key={student.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.username}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{student.plainPassword || '********'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button onClick={() => onDeleteStudent(student)} className="text-red-600 hover:text-red-900">Delete</button>
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
    </div>
);

const AddStudentForm = ({ onAddStudents }) => {
    const [count, setCount] = useState(1);
    const [isGenerating, setIsGenerating] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsGenerating(true);
        await onAddStudents(count);
        setIsGenerating(false);
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-end gap-4">
            <div className="w-full sm:w-auto flex-grow">
                <label htmlFor="studentCount" className="block text-sm font-medium text-gray-700">Number of students:</label>
                <input type="number" id="studentCount" value={count} onChange={e => setCount(parseInt(e.target.value, 10))} min="1" max="50" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <button type="submit" disabled={isGenerating} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-indigo-400">
                {isGenerating ? 'Generating...' : 'Generate'}
            </button>
        </form>
    );
};

export default function ClassView({ classId, onBack, user }) {
    const [classDetails, setClassDetails] = useState(null);
    const [students, setStudents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [credentialsText, setCredentialsText] = useState('');

    const fetchClassData = useCallback(async () => {
        setIsLoading(true);
        try {
            const classRef = doc(db, "classes", classId);
            const classSnap = await getDoc(classRef);

            if (classSnap.exists()) {
                setClassDetails({ id: classSnap.id, ...classSnap.data() });
            } else {
                throw new Error("Class not found.");
            }

            const studentsRef = collection(db, `artifacts/${appId}/public/data/students`);
            const q = query(studentsRef, where("classId", "==", classId));
            const studentSnapshot = await getDocs(q);
            const studentList = studentSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setStudents(studentList);

        } catch (err) {
            console.error("Error fetching class data:", err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [classId]);

    useEffect(() => {
        fetchClassData();
    }, [fetchClassData]);

    const handleDeleteStudent = async (student) => {
        if (window.confirm(`Are you sure you want to delete student ${student.username}? This will also delete all their assignments.`)) {
            try {
                const batch = writeBatch(db);
                
                const assignmentsQuery = query(collection(db, "assignments"), where("studentUID", "==", student.studentUID));
                const assignmentsSnapshot = await getDocs(assignmentsQuery);
                assignmentsSnapshot.forEach(doc => batch.delete(doc.ref));
                
                const studentRef = doc(db, `artifacts/${appId}/public/data/students`, student.id);
                batch.delete(studentRef);
                
                await batch.commit();
                fetchClassData();
            } catch (err) {
                setError(`Failed to delete student: ${err.message}`);
            }
        }
    };
    
    const handleAddStudents = async (count) => {
        setCredentialsText('');
        const adjectives = ["swift", "silent", "clever", "brave", "gentle", "bright", "calm", "eager"];
        const nouns = ["tree", "river", "eagle", "stone", "cloud", "lion", "star", "wolf"];
        const animals = ["fox", "bear", "hawk", "deer", "owl", "cat", "dog", "fish"];
        
        let newCredentialsText = "Username,Password\n";
        const batch = writeBatch(db);

        for (let i = 0; i < count; i++) {
            const username = `${adjectives[Math.floor(Math.random() * adjectives.length)]}-${nouns[Math.floor(Math.random() * nouns.length)]}-${animals[Math.floor(Math.random() * animals.length)]}`;
            const plainPassword = Math.random().toString(36).slice(-8);
            const passwordHash = await sha256(plainPassword);
            const studentUID = crypto.randomUUID();

            const studentRef = doc(collection(db, `artifacts/${appId}/public/data/students`));
            batch.set(studentRef, { classId, username, plainPassword, password: passwordHash, studentUID });
            newCredentialsText += `${username},${plainPassword}\n`;
        }

        try {
            await batch.commit();
            setCredentialsText(newCredentialsText);
            fetchClassData();
        } catch (err) {
            setError(`Failed to generate students: ${err.message}`);
        }
    };

    if (isLoading) {
        return <div className="text-center p-10">Loading class data...</div>;
    }

    if (error) {
        return <div className="text-center p-10 text-red-500">Error: {error}</div>;
    }

    return (
        <div className="bg-gray-50 min-h-screen">
            <nav className="bg-white shadow-md">
                 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <button onClick={onBack} className="text-indigo-600 hover:text-indigo-800 flex items-center">
                           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mr-2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
                            Back to Dashboard
                        </button>
                    </div>
                </div>
            </nav>
            <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-800">{classDetails?.className}</h1>
                    <p className="text-lg text-gray-600">Year {classDetails?.yearGroup}</p>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 space-y-8">
                        <ActionCard title="Post Announcement">
                            {/* Placeholder */}
                        </ActionCard>
                        <ActionCard title="Add New Students">
                             <AddStudentForm onAddStudents={handleAddStudents} />
                        </ActionCard>
                        <ActionCard title="Assign Worksheet">
                             {/* Placeholder */}
                        </ActionCard>
                    </div>

                    <div className="lg:col-span-2 space-y-8">
                        {credentialsText && (
                            <div className="bg-green-50 p-6 rounded-lg shadow-md">
                                <h3 className="text-xl font-semibold mb-4 text-green-800">New Student Credentials</h3>
                                <p className="text-sm text-gray-600 mb-4">Distribute these to your students. This list will disappear on refresh.</p>
                                <textarea readOnly value={credentialsText} className="w-full h-48 p-2 font-mono text-sm bg-white border border-gray-300 rounded-md"></textarea>
                            </div>
                        )}
                        <div>
                            <h3 className="text-xl font-semibold mb-4">Enrolled Students</h3>
                            <StudentList students={students} onDeleteStudent={handleDeleteStudent} />
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold mb-4">Assigned Work</h3>
                            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">Assignments will be listed here.</div>
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold mb-4">Announcements</h3>
                            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">Announcements will be listed here.</div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
