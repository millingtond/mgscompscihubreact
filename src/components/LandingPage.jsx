import React from 'react';

function LandingPage({ setAuthState }) {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="text-center p-12 bg-white rounded-lg shadow-xl">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">MGS Computer Science Hub</h1>
        <p className="text-lg text-gray-600 mb-8">Please select your role to login.</p>
        <div className="space-x-4">
          <button
            onClick={() => setAuthState('teacher-login')}
            className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75"
          >
            I am a Teacher
          </button>
          <button
            onClick={() => setAuthState('student-login')}
            className="px-8 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75"
          >
            I am a Student
          </button>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
