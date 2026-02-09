import { getDB } from "./d1"

// Exam માટે questions લાવો
export async function getQuestionsByExam(env, examId, limit = 10) {
  const db = getDB(env)

  const questions = await db
    .prepare(
      `SELECT id, question, correct_option 
       FROM questions 
       WHERE exam_id = ? 
       ORDER BY RANDOM() 
       LIMIT ?`
    )
    .bind(examId, limit)
    .all()

  return questions.results || []
}

// Question માટે options લાવો
export async function getOptionsByQuestion(env, questionId) {
  const db = getDB(env)

  const options = await db
    .prepare(
      `SELECT option_key, option_text 
       FROM options 
       WHERE question_id = ? 
       ORDER BY option_key`
    )
    .bind(questionId)
    .all()

  return options.results || []
}
