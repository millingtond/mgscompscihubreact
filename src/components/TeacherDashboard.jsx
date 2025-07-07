import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, doc, deleteDoc } from 'firebase/firestore';

function TeacherDashboard({ auth, db, navigateTo }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newYearGroup, setNewYearGroup] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchClasses = async () => {
      if (auth.currentUser) {
        try {
          const q = query(collection(db, "classes"), where("teacherId", "==", auth.currentUser.uid));
          const querySnapshot = await getDocs(q);
          const classesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setClasses(classesList);
        } catch (err) {
          console.error("Error fetching classes: ", err);
          setError("Could not fetch classes.");
        }
      }
      setLoading(false);
    };

    fetchClasses();
  }, [auth.currentUser, db]);

  const handleAddClass = async (e) => {
    e.preventDefault();
    if (!newClassName || !newYearGroup) {
      setError("Please provide a class name and year group.");
      return;
    }
    try {
      const docRef = await addDoc(collection(db, "classes"), {
        className: newClassName,
        yearGroup: parseInt(newYearGroup, 10),
        teacherId: auth.currentUser.uid,
        createdAt: new Date()
      });
      setClasses([...classes, { id: docRef.id, className: newClassName, yearGroup: newYearGroup }]);
      setNewClassName('');
      setNewYearGroup('');
      setShowForm(false);
      setError('');
    } catch (err) {
      console.error("Error adding class: ", err);
      setError("Failed to add class.");
    }
  };
  
  const handleDeleteClass = async (classId) => {
    if (window.confirm("Are you sure you want to delete this class? This cannot be undone.")) {
        try {
            await deleteDoc(doc(db, "classes", classId));
            setClasses(classes.filter(c => c.id !== classId));
        } catch (err) {
            console.error("Error deleting class: ", err);
            setError("Failed to delete class.");
        }
    }
  };


  if (loading) {
    return <div>Loading dashboard...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Your Classes</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
        >
          {showForm ? 'Cancel' : '+ Add Class'}
        </button>
      </div>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <form onSubmit={handleAddClass}>
            <div className="mb-4">
              <label htmlFor="className" className="block text-gray-700 text-sm font-bold mb-2">Class Name</label>
              <input
                type="text"
                id="className"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                placeholder="e.g., 10A/CS1"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="yearGroup" className="block text-gray-700 text-sm font-bold mb-2">Year Group</label>
              <input
                type="number"
                id="yearGroup"
                value={newYearGroup}
                onChange={(e) => setNewYearGroup(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                placeholder="e.g., 10"
              />
            </div>
            <button type="submit" className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
              Create Class
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {classes.length > 0 ? (
          classes.map((c) => (
            <div key={c.id} className="bg-white p-6 rounded-lg shadow-md flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold">{c.className}</h3>
                <p className="text-gray-600">Year {c.yearGroup}</p>
              </div>
              <div className="mt-4 flex justify-between items-center">
                 <button onClick={() => navigateTo('class', c)} className="text-blue-500 hover:underline">View Class</button>
                 <button onClick={() => handleDeleteClass(c.id)} className="text-red-500 hover:text-red-700 font-semibold">Delete</button>
              </div>
            </div>
          ))
        ) : (
          <p>You haven't created any classes yet.</p>
        )}
      </div>
    </div>
  );
}

export default TeacherDashboard;
