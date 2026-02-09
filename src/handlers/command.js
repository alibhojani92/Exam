import { sendMessage } from "../services/telegram"
import { startExam, getFirstQuestionPayload } from "../services/exam.service"

/**
 * Handles all slash commands
 */
export async function handleCommand(ctx, env) {
  const { chatId, text, from, chatType } = ctx
  if (!text) return

  // /start
  if (text === "/start") {
    await sendMessage(
      chatId,
      "👋 Welcome to MCQ Exam Bot\n\n📝 Exam start કરવા માટે /exam લખો"
    )
    return
  }

  // /exam (private + group)
  if (text === "/exam") {
    const result = await startExam(env, {
      telegramUser: from,
      chatId,
      chatType
    })

    if (result.error) {
      await sendMessage(chatId, result.error)
      return
    }

    // Build first question message + keyboard
    const { messageText, keyboard } = await getFirstQuestionPayload(env, result)

    await sendMessage(chatId, messageText, keyboard)
    return
  }

  // Unknown command
  if (text.startsWith("/")) {
    await sendMessage(
      chatId,
      "❌ Command મળ્યો નથી.\n\n/exam લખીને exam શરૂ કરો"
    )
  }
}
