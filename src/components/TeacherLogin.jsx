import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';

function TeacherLogin({ auth, setAuthState }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!email || !password) {
      setError('Please enter an email and password.');
      setLoading(false);
      return;
    }

    try {
      // Use Firebase's built-in email/password authentication
      await signInWithEmailAndPassword(auth, email, password);
      // The onAuthStateChanged listener in App.jsx will handle successful login
    } catch (err) {
      console.error("Teacher login error:", err.code);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else {
        setError('An error occurred during login. Please try again.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800">Teacher Login</h2>
            <p className="text-gray-500 text-sm mt-1">Use your school-provided credentials.</p>
        </div>
        
        {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-md">{error}</p>}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            className="w-full px-4 py-2 font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:shadow-outline disabled:bg-blue-400"
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

export default TeacherLogin;
