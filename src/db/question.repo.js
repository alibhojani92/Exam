import { getDB } from "./d1"

/**
 * Get active exam
 */
export async function getActiveExam(env) {
  const db = getDB(env)

  return await db
    .prepare(
      `SELECT * FROM exams 
       WHERE is_active = 1 
       ORDER BY id DESC 
       LIMIT 1`
    )
    .first()
}

/**
 * Get all questions for an exam (order fixed for attempt)
 */
export async function getQuestionsForExam(env, examId) {
  const db = getDB(env)

  const res = await db
    .prepare(
      `SELECT id 
       FROM questions 
       WHERE exam_id = ? 
       ORDER BY id ASC`
    )
    .bind(examId)
    .all()

  return res.results || []
}

/**
 * Get question by index (0-based)
 */
export async function getQuestionByIndex(env, examId, index) {
  const db = getDB(env)

  return await db
    .prepare(
      `SELECT id, question, correct_option 
       FROM questions 
       WHERE exam_id = ? 
       ORDER BY id ASC 
       LIMIT 1 OFFSET ?`
    )
    .bind(examId, index)
    .first()
}

/**
 * Get options for a question
 */
export async function getOptionsForQuestion(env, questionId) {
  const db = getDB(env)

  const res = await db
    .prepare(
      `SELECT option_key, option_text 
       FROM options 
       WHERE question_id = ? 
       ORDER BY option_key ASC`
    )
    .bind(questionId)
    .all()

  return res.results || []
}
