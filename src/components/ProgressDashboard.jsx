import React, { useState, useEffect } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// A custom tooltip for the charts to show more details
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-sm">
        <p className="font-bold text-gray-800">{data.title}</p>
        <p className="text-sm text-gray-600">Date: {new Date(label).toLocaleDateString()}</p>
        <p className="text-sm text-blue-600">Score: {data.score} / {data.totalMarks} ({data.percentage}%)</p>
      </div>
    );
  }
  return null;
};

const ProgressDashboard = ({ app, navigateTo }) => {
  const [progressData, setProgressData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProgressData = async () => {
      setLoading(true);
      setError('');
      try {
        const functions = getFunctions(app);
        const getStudentProgress = httpsCallable(functions, "getStudentProgress");
        const result = await getStudentProgress();
        
        // Sort data by date to make the line chart chronological
        const sortedData = result.data.sort((a, b) => new Date(a.date) - new Date(b.date));
        setProgressData(sortedData);

      } catch (err) {
        console.error("Error fetching progress data:", err);
        setError("Could not load your progress. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchProgressData();
  }, [app]);

  // Process data for the bar chart to show average percentage score by topic
  const getAverageScoreByTopic = () => {
    if (!progressData.length) return [];
    
    const topics = progressData.reduce((acc, item) => {
      if (!acc[item.topic]) {
        acc[item.topic] = { totalPercentage: 0, count: 0 };
      }
      acc[item.topic].totalPercentage += item.percentage;
      acc[item.topic].count++;
      return acc;
    }, {});

    return Object.keys(topics).map((topic) => ({
      topic,
      "Average Score (%)": Math.round(topics[topic].totalPercentage / topics[topic].count),
    }));
  };

  const averageByTopic = getAverageScoreByTopic();

  return (
    <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow-sm p-4 flex justify-between items-center">
            <button
            onClick={() => navigateTo('dashboard')}
            className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
            >
            &larr; Back to Dashboard
            </button>
            <h1 className="text-xl font-bold text-gray-800">Your Progress Report</h1>
            <div></div> {/* Spacer */}
        </header>

        <main className="container mx-auto p-4 md:p-6">
            {loading && <div className="text-center p-10">Loading your progress...</div>}
            {error && <div className="bg-red-100 text-red-700 p-4 rounded-md">{error}</div>}

            {!loading && !error && progressData.length === 0 && (
                 <div className="bg-white p-8 rounded-lg shadow-md text-center">
                    <h3 className="text-xl font-semibold text-gray-700">No Completed Assignments Yet</h3>
                    <p className="text-gray-500 mt-2">Once you complete some quizzes, your progress will appear here.</p>
                </div>
            )}

            {!loading && progressData.length > 0 && (
                <div className="space-y-8">
                    {/* Scores Over Time Chart */}
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h3 className="text-2xl font-bold mb-4">Scores Over Time (%)</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={progressData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" tickFormatter={(date) => new Date(date).toLocaleDateString()} />
                                <YAxis domain={[0, 100]} label={{ value: '%', angle: -90, position: 'insideLeft' }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend />
                                <Line type="monotone" dataKey="percentage" name="Score" stroke="#8884d8" strokeWidth={2} activeDot={{ r: 8 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Average Score by Topic Chart */}
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h3 className="text-2xl font-bold mb-4">Average Score by Topic</h3>
                         <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={averageByTopic} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="topic" />
                                <YAxis domain={[0, 100]} />
                                <Tooltip cursor={{fill: 'rgba(206, 206, 206, 0.2)'}}/>
                                <Legend />
                                <Bar dataKey="Average Score (%)" fill="#82ca9d" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Table of All Submissions */}
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h3 className="text-2xl font-bold mb-4">All Completed Work</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Worksheet</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Topic</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Percentage</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                {progressData.map((item) => (
                                    <tr key={item.assignmentId}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.title}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.topic}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.score} / {item.totalMarks}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.percentage}%</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(item.date).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </main>
    </div>
  );
};

export default ProgressDashboard;
