import React, { useState, useEffect, useCallback } from 'react';
import { getFirestore, collection, getDocs, addDoc, doc, deleteDoc, query, where, writeBatch, serverTimestamp, updateDoc, orderBy } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const WorksheetRow = ({ worksheet, onUpdate, onDelete }) => (
    <tr>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{worksheet.title}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{worksheet.topic}</td>
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
            <button onClick={() => onUpdate(worksheet)} className="text-indigo-600 hover:text-indigo-900">Update</button>
            <button onClick={() => onDelete(worksheet)} className="text-red-600 hover:text-red-900">Delete</button>
        </td>
    </tr>
);

const UpdateModal = ({ worksheet, onClose, onWorksheetUpdated }) => {
    const [file, setFile] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState('');

    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!file) {
            setError("Please select a new file to upload.");
            return;
        }
        setIsUpdating(true);
        setError('');

        try {
            const storage = getStorage();
            const db = getFirestore();

            // 1. Delete old file from storage
            try {
                const oldFileRef = ref(storage, worksheet.worksheetURL);
                await deleteObject(oldFileRef);
            } catch (storageError) {
                 if (storageError.code !== 'storage/object-not-found') throw storageError;
                 console.warn("Old storage file not found, but proceeding with update.");
            }

            // 2. Upload new file
            const storagePath = `worksheets/${Date.now()}-${file.name}`;
            const storageRef = ref(storage, storagePath);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            // 3. Update Firestore document
            const worksheetRef = doc(db, "worksheets", worksheet.id);
            await updateDoc(worksheetRef, {
                worksheetURL: downloadURL,
                uploadedAt: serverTimestamp()
            });
            
            onWorksheetUpdated();
            onClose();

        } catch (err) {
            setError("Update failed. Please try again.");
            console.error(err);
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                <h3 className="text-2xl font-bold mb-4">Update Worksheet</h3>
                <p className="mb-2"><strong>Title:</strong> {worksheet.title}</p>
                <p className="mb-4"><strong>Topic:</strong> {worksheet.topic}</p>
                
                <form onSubmit={handleUpdate}>
                    <label htmlFor="updateFile" className="block text-sm font-medium text-gray-700">Upload New HTML File</label>
                    <input type="file" id="updateFile" onChange={e => setFile(e.target.files[0])} required accept=".html" className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                    {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                    <div className="flex items-center justify-end space-x-4 pt-6">
                        <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" disabled={isUpdating} className="py-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400">
                            {isUpdating ? 'Updating...' : 'Update Worksheet'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default function ManageWorksheets({ onBack }) {
    const [worksheets, setWorksheets] = useState([]);
    const [filteredWorksheets, setFilteredWorksheets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    
    // Official OCR J277 Specification Topics
    const ocrTopics = [
        "1.1 Systems architecture",
        "1.2 Memory and storage",
        "1.3 Computer networks, connections and protocols",
        "1.4 Network security",
        "1.5 Systems software",
        "1.6 Ethical, legal, cultural and environmental impacts",
        "2.1 Algorithms",
        "2.2 Programming fundamentals",
        "2.3 Producing robust programs",
        "2.4 Boolean logic",
        "2.5 Programming languages and Integrated Development Environments"
    ];

    const [topic, setTopic] = useState(ocrTopics[0]);
    const [file, setFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    
    const [worksheetToUpdate, setWorksheetToUpdate] = useState(null);

    const fetchWorksheets = useCallback(async () => {
        setIsLoading(true);
        try {
            const db = getFirestore();
            const worksheetsRef = collection(db, "worksheets");
            const q = query(worksheetsRef, orderBy("title", "asc"));
            const querySnapshot = await getDocs(q);
            const allWorksheets = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setWorksheets(allWorksheets);
            setFilteredWorksheets(allWorksheets);
        } catch (err) {
            setError("Failed to fetch worksheets.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWorksheets();
    }, [fetchWorksheets]);

    useEffect(() => {
        const lowercasedFilter = searchTerm.toLowerCase();
        const filteredData = worksheets.filter(item =>
            item.title.toLowerCase().includes(lowercasedFilter) ||
            item.topic.toLowerCase().includes(lowercasedFilter)
        );
        setFilteredWorksheets(filteredData);
    }, [searchTerm, worksheets]);

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file || !topic) {
            setError("Please select a topic and a file.");
            return;
        }
        setIsUploading(true);
        setError('');

        const title = file.name.replace(/\.html$/, '').replace(/[-_]/g, ' ');

        try {
            const storage = getStorage();
            const db = getFirestore();
            const storagePath = `worksheets/${Date.now()}-${file.name}`;
            const storageRef = ref(storage, storagePath);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            await addDoc(collection(db, "worksheets"), {
                title,
                topic,
                worksheetURL: downloadURL,
                uploadedAt: serverTimestamp()
            });

            setTopic(ocrTopics[0]);
            setFile(null);
            e.target.reset();
            fetchWorksheets();
        } catch (err) {
            setError("Upload failed. Please try again.");
            console.error(err);
        } finally {
            setIsUploading(false);
        }
    };
    
    const handleDelete = async (worksheet) => {
        if (window.confirm(`Are you sure you want to delete "${worksheet.title}"? This will also delete all associated assignments.`)) {
            try {
                const storage = getStorage();
                const db = getFirestore();
                const fileRef = ref(storage, worksheet.worksheetURL);
                await deleteObject(fileRef);

                const batch = writeBatch(db);
                const assignmentsQuery = query(collection(db, "assignments"), where("worksheetId", "==", worksheet.id));
                const assignmentsSnapshot = await getDocs(assignmentsQuery);
                assignmentsSnapshot.forEach(doc => batch.delete(doc.ref));
                
                const worksheetRef = doc(db, "worksheets", worksheet.id);
                batch.delete(worksheetRef);

                await batch.commit();
                fetchWorksheets();
            } catch (err) {
                setError(`Failed to delete worksheet: ${err.message}`);
                console.error(err);
            }
        }
    };

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
                {error && <p className="text-red-500 bg-red-100 p-3 rounded-md text-center mb-6">{error}</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="bg-white p-8 rounded-lg shadow-md">
                        <h2 className="text-3xl font-semibold text-gray-800 mb-6">Upload New Worksheet</h2>
                        <form onSubmit={handleUpload} className="space-y-6">
                            <div>
                                <label htmlFor="worksheetTopic" className="block text-sm font-medium text-gray-700">Topic</label>
                                <select id="worksheetTopic" value={topic} onChange={e => setTopic(e.target.value)} required className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                                    {ocrTopics.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="worksheetFile" className="block text-sm font-medium text-gray-700">Worksheet File (.html)</label>
                                <input type="file" id="worksheetFile" onChange={e => setFile(e.target.files[0])} required accept=".html" className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                            </div>
                            <button type="submit" disabled={isUploading} className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 disabled:bg-indigo-400">
                                {isUploading ? 'Uploading...' : 'Upload New Worksheet'}
                            </button>
                        </form>
                    </div>
                    <div>
                        <h2 className="text-3xl font-semibold text-gray-800 mb-6">Existing Worksheets</h2>
                        <input type="search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search by title or topic..." className="block w-full mb-4 px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                        <div className="bg-white rounded-lg shadow overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Topic</th>
                                        <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {isLoading ? (
                                        <tr><td colSpan="3" className="px-6 py-4 text-center">Loading...</td></tr>
                                    ) : (
                                        filteredWorksheets.map(ws => <WorksheetRow key={ws.id} worksheet={ws} onDelete={handleDelete} onUpdate={setWorksheetToUpdate} />)
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
            {worksheetToUpdate && (
                <UpdateModal 
                    worksheet={worksheetToUpdate}
                    onClose={() => setWorksheetToUpdate(null)}
                    onWorksheetUpdated={fetchWorksheets}
                />
            )}
        </div>
    );
}
