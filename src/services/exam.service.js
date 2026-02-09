import { getOrCreateUser } from "../db/user.repo"
import {
  createAttempt,
  getActiveAttemptByUserAndChat,
  saveAnswer,
  finishAttempt
} from "../db/attempt.repo"
import {
  getActiveExam,
  getQuestionsForExam,
  getQuestionByIndex,
  getOptionsForQuestion
} from "../db/question.repo"
import { examKeyboard } from "../keyboards/exam.keyboard"

/**
 * Start exam for user in a chat (private or group)
 */
export async function startExam(env, { telegramUser, chatId, chatType }) {
  const user = await getOrCreateUser(env, telegramUser)
  const exam = await getActiveExam(env)

  if (!exam) {
    return { error: "❌ હાલ કોઈ active exam નથી" }
  }

  // Prevent parallel attempts in same chat
  const existing = await getActiveAttemptByUserAndChat(
    env,
    user.id,
    chatId
  )
  if (existing) {
    return { error: "⚠️ Exam પહેલેથી ચાલુ છે. Answer પસંદ કરો." }
  }

  const questions = await getQuestionsForExam(env, exam.id)
  if (!questions.length) {
    return { error: "❌ Exam માં questions નથી" }
  }

  const attempt = await createAttempt(env, {
    userId: user.id,
    examId: exam.id,
    chatId,
    total: questions.length
  })

  return {
    attemptId: attempt.id,
    examId: exam.id,
    questionIndex: 0
  }
}

/**
 * Build first question payload
 */
export async function getFirstQuestionPayload(env, startResult) {
  const question = await getQuestionByIndex(
    env,
    startResult.examId,
    startResult.questionIndex
  )
  return buildQuestionPayload(env, question, 1)
}

/**
 * Handle answer click and decide next step
 */
export async function handleAnswerAndGetNext(env, {
  telegramUser,
  chatId,
  selectedOption
}) {
  const user = await getOrCreateUser(env, telegramUser)
  const attempt = await getActiveAttemptByUserAndChat(
    env,
    user.id,
    chatId
  )

  if (!attempt) {
    return { error: "❌ Active exam મળ્યો નથી" }
  }

  // Current question
  const question = await getQuestionByIndex(
    env,
    attempt.exam_id,
    attempt.current_index
  )

  const isCorrect = question.correct_option === selectedOption

  await saveAnswer(env, {
    attemptId: attempt.id,
    questionId: question.id,
    selectedOption,
    isCorrect
  })

  // Last question?
  if (attempt.current_index + 1 >= attempt.total_questions) {
    const result = await finishAttempt(env, attempt.id)

    return {
      finished: true,
      score: result.score,
      total: attempt.total_questions,
      correct: result.correct,
      wrong: result.wrong
    }
  }

  // Move to next question
  return {
    finished: false,
    attemptId: attempt.id,
    examId: attempt.exam_id,
    questionIndex: attempt.current_index + 1
  }
}

/**
 * Build payload for any question by attempt state
 */
export async function getQuestionPayloadByAttempt(env, nextState) {
  const question = await getQuestionByIndex(
    env,
    nextState.examId,
    nextState.questionIndex
  )
  return buildQuestionPayload(
    env,
    question,
    nextState.questionIndex + 1
  )
}

/**
 * Internal helper: message text + keyboard
 */
async function buildQuestionPayload(env, question, displayIndex) {
  const options = await getOptionsForQuestion(env, question.id)

  const messageText =
    `📝 Q${displayIndex}: ${question.question}\n\n` +
    options.map(o => `${o.option_key}) ${o.option_text}`).join("\n")

  return {
    messageText,
    keyboard: examKeyboard(options)
  }
}
