const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();

const sha256 = (data) => crypto.createHash('sha256').update(data, 'utf-8').digest('hex');

exports.loginStudent = onCall(async (request) => {
  const { username, password } = request.data;

  if (!username || !password) {
    throw new HttpsError("invalid-argument", "Please provide a username and password.");
  }

  const db = admin.firestore();
  const studentsRef = db.collection("students");
  const snapshot = await studentsRef.where("username", "==", username).limit(1).get();

  if (snapshot.empty) {
    throw new HttpsError("not-found", "Invalid username or password.");
  }

  const studentDoc = snapshot.docs[0];
  const studentData = studentDoc.data();
  const hashedPassword = sha256(password);

  if (studentData.password !== hashedPassword) {
    throw new HttpsError("not-found", "Invalid username or password.");
  }

  const customClaims = {
    studentUID: studentData.studentUID,
    classId: studentData.classId,
  };

  const customToken = await admin.auth().createCustomToken(studentDoc.id, customClaims);
  
  return { token: customToken, user: studentData };
});

exports.submitQuiz = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to submit a quiz.");
  }

  const studentUIDFromToken = request.auth.token.studentUID;

  if (!studentUIDFromToken) {
      throw new HttpsError("permission-denied", "The user token is missing student information.");
  }

  const { assignmentId, answers } = request.data;

  if (!assignmentId || !Array.isArray(answers)) {
    throw new HttpsError("invalid-argument", "Missing required data for quiz submission.");
  }

  const db = admin.firestore();
  const assignmentRef = db.collection("assignments").doc(assignmentId);
  const assignmentDoc = await assignmentRef.get();

  if (!assignmentDoc.exists) {
    throw new HttpsError("not-found", "Assignment not found.");
  }
  
  const assignmentData = assignmentDoc.data();

  if (assignmentData.studentUID !== studentUIDFromToken) {
     logger.error("Authorization failed", { 
        tokenUID: studentUIDFromToken, 
        assignmentUID: assignmentData.studentUID 
     });
     throw new HttpsError("permission-denied", "You are not authorized to submit this assignment.");
  }
  
  if (assignmentData.status === "Completed") {
    throw new HttpsError("failed-precondition", "This quiz has already been submitted and graded.");
  }
  
  // --- THIS IS THE KEY FIX ---
  // 1. Get the worksheetId from the assignment.
  const worksheetId = assignmentData.worksheetId;
  if (!worksheetId) {
    throw new HttpsError("failed-precondition", "Assignment is missing worksheet ID.");
  }

  // 2. Fetch the worksheet document from the 'worksheets' collection.
  const worksheetRef = db.collection("worksheets").doc(worksheetId);
  const worksheetDoc = await worksheetRef.get();

  if (!worksheetDoc.exists) {
    throw new HttpsError("not-found", "Worksheet data could not be found.");
  }
  
  // 3. Use the data from the fetched worksheet for grading.
  const worksheetData = worksheetDoc.data();
  if (!worksheetData || worksheetData.type !== "quiz" || !worksheetData.questions) {
      throw new HttpsError("failed-precondition", "Invalid worksheet data.");
  }

  let correctCount = 0;
  worksheetData.questions.forEach((q, index) => {
    if (q.correctAnswerIndex === answers[index]) {
      correctCount++;
    }
  });

  const score = correctCount;

  await assignmentRef.update({
    status: "Completed",
    mark: score,
    feedback: "This quiz was automatically graded.",
    submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    studentWork: { answers: answers, score: score },
  });

  return { success: true, score: score };
});
