import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, deleteDoc, query, where, orderBy, setDoc, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';

// J277 OCR GCSE Specification Topics
const ocrTopics = [
  "1.1 Systems Architecture",
  "1.2 Memory and Storage",
  "1.3 Computer Networks, Connections and Protocols",
  "1.4 Network Security",
  "1.5 Systems Software",
  "1.6 Ethical, Legal, Cultural and Environmental Impacts",
  "2.1 Algorithms",
  "2.2 Programming Fundamentals",
  "2.3 Producing Robust Programs",
  "2.4 Boolean Logic",
  "2.5 Programming Languages and IDEs",
  "Other"
];

function ManageWorksheets({ db, storage, navigateTo }) {
  const [worksheets, setWorksheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // State for the upload form
  const [uploadTopic, setUploadTopic] = useState(ocrTopics[0]);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [mainFileIndex, setMainFileIndex] = useState(-1);
  const [isUploading, setIsUploading] = useState(false);

  const fetchWorksheets = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "worksheets"), orderBy("topic"), orderBy("title"));
      const querySnapshot = await getDocs(q);
      const worksheetsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setWorksheets(worksheetsList);
    } catch (err) {
      console.error("Error fetching worksheets:", err);
      setError("Failed to fetch worksheets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorksheets();
  }, []);

  const resetUploadForm = () => {
    setUploadFiles([]);
    setMainFileIndex(-1);
    setUploadTopic(ocrTopics[0]);
    const fileInput = document.getElementById('new-worksheet-file-input');
    if (fileInput) fileInput.value = '';
  };
  
  const handleFileSelection = (e) => {
    const files = Array.from(e.target.files);
    setUploadFiles(files);
    const firstHtmlIndex = files.findIndex(file => file.name.toLowerCase().endsWith('.html'));
    setMainFileIndex(firstHtmlIndex);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (uploadFiles.length === 0 || mainFileIndex === -1) {
      setError("Please select files and designate a main HTML file.");
      return;
    }
    
    setIsUploading(true);
    setError('');

    const newWorksheetRef = doc(collection(db, "worksheets"));
    const worksheetId = newWorksheetRef.id;
    const mainFile = uploadFiles[mainFileIndex];

    try {
      const fileMap = {};
      const uploadPromises = uploadFiles.map(async (file) => {
        const fileRef = ref(storage, `worksheets/${worksheetId}/${file.name}`);
        await uploadBytes(fileRef, file);
        const downloadURL = await getDownloadURL(fileRef);
        fileMap[file.name] = downloadURL;
      });
      await Promise.all(uploadPromises);
      
      const mainFileDownloadURL = fileMap[mainFile.name];

      await setDoc(newWorksheetRef, {
        title: mainFile.name.replace(/\.html$/i, ''),
        topic: uploadTopic,
        worksheetURL: mainFileDownloadURL,
        storagePath: `worksheets/${worksheetId}`,
        fileMap: fileMap,
        createdAt: new Date(),
      });
      
      resetUploadForm();
      await fetchWorksheets();
    } catch (err) {
      console.error("Error creating worksheet bundle:", err);
      setError("Failed to create worksheet bundle.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (worksheet) => {
    if (window.confirm(`Are you sure you want to permanently delete "${worksheet.title}"? This will also delete all assignments linked to it.`)) {
      try {
        // 1. Find and delete all associated assignments
        const assignmentsRef = collection(db, "assignments");
        const q = query(assignmentsRef, where("worksheetId", "==", worksheet.id));
        const assignmentsSnapshot = await getDocs(q);
        
        const batch = writeBatch(db);
        assignmentsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        // 2. Delete all files in the storage folder
        const folderRef = ref(storage, worksheet.storagePath);
        const fileList = await listAll(folderRef);
        const deletePromises = fileList.items.map(itemRef => deleteObject(itemRef));
        await Promise.all(deletePromises);

        // 3. Delete the worksheet document from Firestore
        await deleteDoc(doc(db, "worksheets", worksheet.id));
        
        // 4. Update UI
        setWorksheets(prev => prev.filter(w => w.id !== worksheet.id));
      } catch (err) {
        console.error("Error deleting worksheet bundle and assignments:", err);
        setError("Failed to delete worksheet. It may have been partially deleted.");
      }
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">Manage Worksheets</h2>

      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h3 className="text-2xl font-semibold mb-4">Add New Worksheet Bundle</h3>
        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label htmlFor="topic" className="block text-sm font-medium text-gray-700">Topic (OCR J277)</label>
            <select id="topic" value={uploadTopic} onChange={(e) => setUploadTopic(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md bg-white">
              {ocrTopics.map(topic => <option key={topic} value={topic}>{topic}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="new-worksheet-file-input" className="block text-sm font-medium text-gray-700">Worksheet Files (HTML, CSS, JS, etc.)</label>
            <input type="file" id="new-worksheet-file-input" onChange={handleFileSelection} multiple className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" required />
          </div>

          {uploadFiles.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Select Main HTML File</label>
              <div className="mt-2 p-3 bg-gray-50 border rounded-md max-h-48 overflow-y-auto">
                {uploadFiles.map((file, index) => (
                  file.name.toLowerCase().endsWith('.html') ? (
                    <div key={index} className="flex items-center">
                      <input type="radio" id={`file-${index}`} name="main-file" checked={mainFileIndex === index} onChange={() => setMainFileIndex(index)} className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"/>
                      <label htmlFor={`file-${index}`} className="ml-3 block text-sm font-medium text-gray-700">{file.name}</label>
                    </div>
                  ) : (
                     <div key={index} className="flex items-center ml-7">
                        <span className="text-sm text-gray-500">{file.name} (asset)</span>
                     </div>
                  )
                ))}
              </div>
               {mainFileIndex === -1 && <p className="text-red-500 text-xs mt-1">Please select a main HTML file.</p>}
            </div>
          )}

          <div className="flex items-center">
            <button type="submit" disabled={isUploading || mainFileIndex === -1} className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-blue-300">
              {isUploading ? 'Uploading...' : 'Upload New Worksheet'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-2xl font-semibold mb-4">Worksheet Library</h3>
        {loading ? <p>Loading worksheets...</p> : (
          <div className="space-y-3">
            {worksheets.length > 0 ? worksheets.map(worksheet => (
              <div key={worksheet.id} className="p-4 bg-gray-50 rounded-md border">
                <div className="flex flex-col md:flex-row justify-between md:items-center">
                  <div>
                    <p className="font-bold text-lg">{worksheet.title}</p>
                    <p className="text-gray-600 text-sm">{worksheet.topic}</p>
                  </div>
                  <div className="flex items-center space-x-2 mt-2 md:mt-0">
                    <button onClick={() => navigateTo('worksheet-viewer', null, null, worksheet)} className="bg-green-100 text-green-800 px-3 py-1 rounded-md text-sm hover:bg-green-200">View</button>
                    <button onClick={() => handleDelete(worksheet)} className="bg-red-100 text-red-800 px-3 py-1 rounded-md text-sm hover:bg-red-200">Delete</button>
                  </div>
                </div>
              </div>
            )) : <p>No worksheets found. Add one using the form above.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export default ManageWorksheets;
