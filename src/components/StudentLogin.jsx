import { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';

// Helper function to hash a string using SHA-256
const sha256 = async (str) => {
    const textAsBuffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', textAsBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const studentsCollectionPath = 'students';

function StudentLogin({ db, auth, setLoggedInStudent, setAuthState }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!username || !password) {
      setError('Please enter a username and password.');
      setLoading(false);
      return;
    }

    try {
      const studentsRef = collection(db, studentsCollectionPath);
      const q = query(studentsRef, where("username", "==", username.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('Invalid username or password.');
        setLoading(false);
        return;
      }

      const studentDoc = querySnapshot.docs[0];
      const studentData = studentDoc.data();
      
      // FIX: Trim whitespace from the password before hashing
      const hashedPassword = await sha256(password.trim());

      // --- For Debugging (uncomment if login still fails) ---
      // console.log("Password from input:", password.trim());
      // console.log("Hashed input:", hashedPassword);
      // console.log("Stored hash:", studentData.password);
      // ----------------------------------------------------

      if (studentData.password === hashedPassword) {
        await signInAnonymously(auth);
        setLoggedInStudent({ id: studentDoc.id, ...studentData });
      } else {
        setError('Invalid username or password.');
      }

    } catch (err) {
      console.error("Login error:", err);
      setError('An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-800">Student Login</h2>
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 font-bold text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:shadow-outline disabled:bg-green-400"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
         <button onClick={() => setAuthState('landing')} className="w-full text-sm text-center text-gray-600 hover:underline mt-4">
            Back to role selection
        </button>
      </div>
    </div>
  );
}

export default StudentLogin;
