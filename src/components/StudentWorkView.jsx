import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import WorksheetViewer from './WorksheetViewer';

const StudentWorkView = ({ student, onClose, db, auth }) => {
    const [assignments, setAssignments] = useState([]);
    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null); // State for confirmation modal

    // Effect to fetch the student's assignments in real-time
    useEffect(() => {
        if (student) {
            const q = query(collection(db, "assignments"), where("studentId", "==", student.id));
            const unsubscribe = onSnapshot(q, (querySnapshot) => {
                const studentAssignments = [];
                querySnapshot.forEach((doc) => {
                    studentAssignments.push({ id: doc.id, ...doc.data() });
                });
                setAssignments(studentAssignments);
            });
            return () => unsubscribe();
        }
    }, [student, db]);

    // Function to handle the deletion of an assignment
    const handleDeleteAssignment = async (assignmentId) => {
        if (!assignmentId) return;
        try {
            await deleteDoc(doc(db, 'assignments', assignmentId));
            console.log("Assignment deleted successfully");
        } catch (error) {
            console.error("Error deleting assignment: ", error);
            // In a real app, you'd show a more user-friendly error message
        }
        setShowDeleteConfirm(null); // Close the confirmation modal after deletion
    };

    // If an assignment is selected, show the worksheet viewer
    if (selectedAssignment) {
        return (
            <WorksheetViewer
                assignment={selectedAssignment}
                onClose={() => setSelectedAssignment(null)}
                db={db}
                auth={auth}
                isTeacherView={true}
            />
        );
    }

    // Main modal view showing the list of assignments
    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-40">
                <div className="bg-gray-900 text-white rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-2xl mx-4">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-2xl font-bold text-white">
                            Work for <span className="text-cyan-400">{student.username}</span>
                        </h3>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="mt-4 space-y-4">
                        <h4 className="font-semibold text-lg border-b border-gray-700 pb-2">Assigned Work</h4>
                        {assignments.length > 0 ? (
                            <ul className="divide-y divide-gray-800 max-h-96 overflow-y-auto pr-2">
                                {assignments.map((assignment) => (
                                    <li key={assignment.id} className="py-3 flex justify-between items-center">
                                        <div>
                                            <p className="font-medium">{assignment.worksheetName}</p>
                                            <p className="text-sm text-gray-400">Status: {assignment.status}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => setSelectedAssignment(assignment)} 
                                                className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-transform transform hover:scale-105"
                                            >
                                                View & Mark
                                            </button>
                                            {/* NEW: Delete button for each assignment */}
                                            <button 
                                                onClick={() => setShowDeleteConfirm(assignment)} 
                                                className="text-sm bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-transform transform hover:scale-105"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-400 italic">No work assigned yet.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* NEW: Confirmation Modal for Deletion */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex justify-center items-center z-50">
                    <div className="bg-gray-800 border border-red-500 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
                        <h3 className="text-lg font-bold text-red-400 mb-4">Are you sure?</h3>
                        <p className="mb-6 text-gray-300">
                            Do you really want to delete the assignment "{showDeleteConfirm.worksheetName}" for this student? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-4">
                            <button 
                                onClick={() => setShowDeleteConfirm(null)} 
                                className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => handleDeleteAssignment(showDeleteConfirm.id)} 
                                className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                            >
                                Delete Assignment
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default StudentWorkView;
