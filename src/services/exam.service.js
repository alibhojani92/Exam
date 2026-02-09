import { getActiveExam, startAttempt, completeAttempt } from "../db/exam.repo"
import { getQuestionsByExam, getOptionsByQuestion } from "../db/question.repo"
import { getOrCreateUser } from "../db/user.repo"

/**
 * Exam start flow
 */
export async function startExam(env, telegramUser) {
  // user get/create
  const user = await getOrCreateUser(env, telegramUser)

  // active exam
  const exam = await getActiveExam(env)
  if (!exam) {
    return { error: "❌ હાલ કોઈ active exam નથી" }
  }

  // start attempt
  const attempt = await startAttempt(env, user.id, exam.id)

  // questions
  const questions = await getQuestionsByExam(env, exam.id)

  if (questions.length === 0) {
    return { error: "❌ Exam માં questions નથી" }
  }

  return {
    attemptId: attempt.id,
    examId: exam.id,
    questions
  }
}

/**
 * Single question with options
 */
export async function getQuestionWithOptions(env, question) {
  const options = await getOptionsByQuestion(env, question.id)

  return {
    id: question.id,
    text: question.question,
    options,
    correct: question.correct_option
  }
}

/**
 * Finish exam
 */
export async function finishExam(env, attemptId, score) {
  await completeAttempt(env, attemptId, score)
}
