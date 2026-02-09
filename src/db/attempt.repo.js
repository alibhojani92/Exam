import { getDB } from "./d1"

/**
 * Create new exam attempt
 */
export async function createAttempt(env, { userId, examId, chatId, total }) {
  const db = getDB(env)

  const res = await db
    .prepare(
      `INSERT INTO attempts 
       (user_id, exam_id, chat_id, total_questions, current_index) 
       VALUES (?, ?, ?, ?, 0)`
    )
    .bind(userId, examId, chatId, total)
    .run()

  return {
    id: res.meta.last_row_id,
    user_id: userId,
    exam_id: examId,
    chat_id: chatId,
    total_questions: total,
    current_index: 0
  }
}

/**
 * Get active attempt for a user in a chat
 */
export async function getActiveAttemptByUserAndChat(env, userId, chatId) {
  const db = getDB(env)

  return await db
    .prepare(
      `SELECT * FROM attempts 
       WHERE user_id = ? 
         AND chat_id = ? 
         AND completed_at IS NULL
       LIMIT 1`
    )
    .bind(userId, chatId)
    .first()
}

/**
 * Save answer and move index
 */
export async function saveAnswer(env, {
  attemptId,
  questionId,
  selectedOption,
  isCorrect
}) {
  const db = getDB(env)

  // Save answer
  await db
    .prepare(
      `INSERT INTO answers 
       (attempt_id, question_id, selected_option, is_correct) 
       VALUES (?, ?, ?, ?)`
    )
    .bind(attemptId, questionId, selectedOption, isCorrect ? 1 : 0)
    .run()

  // Increment question index
  await db
    .prepare(
      `UPDATE attempts 
       SET current_index = current_index + 1 
       WHERE id = ?`
    )
    .bind(attemptId)
    .run()
}

/**
 * Finish attempt and calculate result
 */
export async function finishAttempt(env, attemptId) {
  const db = getDB(env)

  const stats = await db
    .prepare(
      `SELECT 
         SUM(is_correct) as correct,
         COUNT(*) as total
       FROM answers
       WHERE attempt_id = ?`
    )
    .bind(attemptId)
    .first()

  const correct = stats?.correct || 0
  const total = stats?.total || 0
  const wrong = total - correct
  const score = correct

  await db
    .prepare(
      `UPDATE attempts 
       SET completed_at = CURRENT_TIMESTAMP, score = ? 
       WHERE id = ?`
    )
    .bind(score, attemptId)
    .run()

  return { correct, wrong, score }
}
