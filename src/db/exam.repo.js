import { getDB } from "./d1"

// Active exam લાવો
export async function getActiveExam(env) {
  const db = getDB(env)

  return await db
    .prepare("SELECT * FROM exams WHERE is_active = 1 ORDER BY id DESC LIMIT 1")
    .first()
}

// Exam attempt start કરો
export async function startAttempt(env, userId, examId) {
  const db = getDB(env)

  const result = await db
    .prepare(
      "INSERT INTO attempts (user_id, exam_id) VALUES (?, ?)"
    )
    .bind(userId, examId)
    .run()

  return {
    id: result.meta.last_row_id,
    user_id: userId,
    exam_id: examId
  }
}

// Attempt complete કરો
export async function completeAttempt(env, attemptId, score) {
  const db = getDB(env)

  await db
    .prepare(
      "UPDATE attempts SET score = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
    .bind(score, attemptId)
    .run()
}
