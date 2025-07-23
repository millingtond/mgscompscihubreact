import React, { useState } from 'react';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

// The component now only needs `setAuthState` and `app` as props.
function StudentLogin({ setAuthState, app }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter a username and password.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const functions = getFunctions(app);
      const auth = getAuth(app);
      const loginStudent = httpsCallable(functions, 'loginStudent');

      const result = await loginStudent({ username, password });
      const { token } = result.data;

      // Sign in with the custom token. The onAuthStateChanged listener in App.jsx
      // will automatically handle the redirect to the dashboard.
      await signInWithCustomToken(auth, token);

      // No longer need to call onLogin here.

    } catch (err) {
      console.error('Login Error:', err);
      setError(err.message || 'An unknown error occurred.');
      setLoading(false); // Stop loading on error
    }
    // Don't set loading to false on success, as the page will redirect.
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
        <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-gray-800">Student Portal</h2>
            <p className="text-gray-500">Welcome back!</p>
        </div>
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="shadow-sm appearance-none border rounded w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. quiet-tiger-797"
              autoComplete="username"
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="shadow-sm appearance-none border rounded w-full py-3 px-4 text-gray-700 mb-3 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="******************"
              autoComplete="current-password"
            />
          </div>
          {error && <p className="bg-red-100 text-red-700 text-sm p-3 rounded-md mb-4">{error}</p>}
          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded focus:outline-none focus:shadow-outline w-full transition-colors duration-300 disabled:bg-blue-300"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </div>
           <div className="text-center mt-4">
                <button 
                    type="button" 
                    onClick={() => setAuthState('landing')} 
                    className="text-sm text-blue-600 hover:underline"
                >
                    &larr; Back to main page
                </button>
            </div>
        </form>
      </div>
    </div>
  );
}

export default StudentLogin;
