import { editMessage, sendMessage } from "../services/telegram"
import {
  handleAnswerAndGetNext,
  getQuestionPayloadByAttempt
} from "../services/exam.service"

/**
 * Handles inline keyboard callbacks (MCQ answers)
 */
export async function handleCallback(ctx, env) {
  const { chatId, messageId, data, from } = ctx

  // We only handle MCQ answers here
  if (!data || !data.startsWith("ANSWER_")) return

  // Extract chosen option (A/B/C/D)
  const selectedOption = data.replace("ANSWER_", "")

  // Process answer + get next step
  const result = await handleAnswerAndGetNext(env, {
    telegramUser: from,
    chatId,
    selectedOption
  })

  // Error (no active attempt, etc.)
  if (result.error) {
    await sendMessage(chatId, result.error)
    return
  }

  // Exam finished → show final result
  if (result.finished) {
    const finalText =
      `✅ Exam Completed\n\n` +
      `Score: ${result.score}/${result.total}\n` +
      `Correct: ${result.correct}\n` +
      `Wrong: ${result.wrong}`

    await editMessage(chatId, messageId, finalText)
    return
  }

  // Next question payload
  const payload = await getQuestionPayloadByAttempt(env, result)

  await editMessage(
    chatId,
    messageId,
    payload.messageText,
    payload.keyboard
  )
}
