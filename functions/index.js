const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();

const sha256 = (data) => crypto.createHash('sha256').update(data, 'utf-8').digest('hex');

/**
 * Authenticates a student based on username and password.
 * Returns a custom Firebase auth token with claims.
 */
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

  // Custom claims to identify the user as a student and store their classId
  const customClaims = {
    studentUID: studentData.studentUID,
    classId: studentData.classId,
  };

  const customToken = await admin.auth().createCustomToken(studentDoc.id, customClaims);
  
  return { token: customToken };
});

/**
 * Marks a student's quiz submission.
 * Calculates the score and updates the assignment document in Firestore.
 */
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
  
  const worksheetId = assignmentData.worksheetId;
  if (!worksheetId) {
    throw new HttpsError("failed-precondition", "Assignment is missing worksheet ID.");
  }

  const worksheetRef = db.collection("worksheets").doc(worksheetId);
  const worksheetDoc = await worksheetRef.get();

  if (!worksheetDoc.exists) {
    throw new HttpsError("not-found", "Worksheet data could not be found.");
  }
  
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
  const totalQuestions = worksheetData.questions.length;

  await assignmentRef.update({
    status: "Completed",
    mark: score,
    totalMarks: totalQuestions,
    feedback: "This quiz was automatically graded.",
    submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    studentWork: { answers: answers, score: score },
  });

  return { success: true, score: score, totalMarks: totalQuestions };
});


/**
 * NEW FUNCTION
 * Fetches all completed assignments for the authenticated student to track progress.
 */
exports.getStudentProgress = onCall(async (request) => {
  // Ensure the user is authenticated and is a student.
  if (!request.auth || !request.auth.token.studentUID) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called by an authenticated student."
    );
  }

  const studentUid = request.auth.token.studentUID;
  const db = admin.firestore();
  
  try {
    // Query all assignments for the student that are marked as 'Completed'.
    const assignmentsRef = db.collection("assignments");
    const assignmentsSnapshot = await assignmentsRef
      .where("studentUID", "==", studentUid)
      .where("status", "==", "Completed")
      .get();

    if (assignmentsSnapshot.empty) {
      return [];
    }

    // Use Promise.all to fetch all worksheet details in parallel for efficiency.
    const progressData = await Promise.all(
      assignmentsSnapshot.docs.map(async (doc) => {
        const assignment = doc.data();
        const worksheetId = assignment.worksheetId;
        const score = assignment.mark;
        const totalMarks = assignment.totalMarks || 0;
        // Convert Firestore Timestamp to a JavaScript Date object.
        const timestamp = assignment.submittedAt.toDate(); 

        // Get the corresponding worksheet to retrieve its title and topic.
        const worksheetDoc = await db.collection("worksheets").doc(worksheetId).get();
        
        if (worksheetDoc.exists) {
          const worksheetData = worksheetDoc.data();
          return {
            assignmentId: doc.id,
            title: worksheetData.title,
            topic: worksheetData.topic || "General", // Use a default if topic is not set.
            score: score,
            totalMarks: totalMarks,
            percentage: totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0,
            date: timestamp.toISOString(), // Return date in ISO format.
          };
        }
        return null; // Return null if worksheet is not found.
      })
    );

    // Filter out any null results and return the data.
    return progressData.filter(item => item !== null);

  } catch (error) {
    logger.error("Error fetching student progress:", error);
    throw new HttpsError(
      "internal",
      "Unable to fetch student progress."
    );
  }
});
