const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * A secure, callable function to submit a student's quiz answers.
 * This version includes robust data validation to prevent server crashes.
 */
exports.submitQuiz = functions.https.onCall(async (data, context) => {
  // 1. --- Security and Input Validation ---
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be logged in to submit a quiz.",
    );
  }

  const { assignmentId, answers } = data;
  if (!assignmentId || !Array.isArray(answers)) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "The function must be called with an 'assignmentId' and 'answers' array.",
    );
  }

  const studentAuthUID = context.auth.uid;

  try {
    // 2. --- Get Data from Firestore with Validation ---
    const assignmentRef = db.collection("assignments").doc(assignmentId);
    const assignmentDoc = await assignmentRef.get();

    if (!assignmentDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Assignment not found.");
    }

    const assignment = assignmentDoc.data();

    // CRITICAL FIX: Add explicit checks for required fields.
    if (!assignment.studentAuthUID) {
      throw new functions.https.HttpsError("failed-precondition", "Assignment is missing student authentication ID.");
    }

    // Security Check: Make sure the logged-in user owns this assignment.
    if (assignment.studentAuthUID !== studentAuthUID) {
      throw new functions.https.HttpsError(
          "permission-denied",
          "You do not have permission to submit this assignment.",
      );
    }

    const worksheetRef = db.collection("worksheets").doc(assignment.worksheetId);
    const worksheetDoc = await worksheetRef.get();

    if (!worksheetDoc.exists()) {
        throw new functions.https.HttpsError("not-found", "Worksheet data for this quiz could not be found.");
    }

    const worksheet = worksheetDoc.data();

    // CRITICAL FIX: Ensure the worksheet is a valid quiz with questions.
    if (worksheet.type !== "quiz" || !Array.isArray(worksheet.questions) || worksheet.questions.length === 0) {
        throw new functions.https.HttpsError("failed-precondition", "This worksheet is not a valid, non-empty quiz.");
    }

    const correctAnswers = worksheet.questions;

    // 3. --- Grade the Quiz ---
    let correctCount = 0;
    correctAnswers.forEach((question, index) => {
      if (question.correctAnswerIndex === answers[index]) {
        correctCount++;
      }
    });
    const score = `${correctCount} / ${correctAnswers.length}`;

    // 4. --- Update the Database Securely ---
    await assignmentRef.update({
      status: "Completed",
      mark: score,
      feedback: "This quiz was automatically graded.",
      studentWork: {
        answers: answers,
        score: score,
      },
    });

    // 5. --- Return the Result ---
    return { status: "success", score: score };

  } catch (error) {
    console.error("Error in submitQuiz function:", error);
    if (error instanceof functions.https.HttpsError) {
        throw error;
    }
    throw new functions.https.HttpsError("internal", error.message || "An internal error occurred.");
  }
});