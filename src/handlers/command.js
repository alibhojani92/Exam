import { sendMessage } from "../services/telegram"
import { mainMenuKeyboard } from "../keyboards/main.menu"

export async function handleCommand(ctx) {
  const { chatId, text } = ctx

  if (!text) return

  // /start command
  if (text === "/start") {
    await sendMessage(
      chatId,
      "👋 Welcome to MCQ Exam Bot\n\nMenu માંથી option પસંદ કરો 👇",
      mainMenuKeyboard()
    )
    return
  }

  // Unknown command
  if (text.startsWith("/")) {
    await sendMessage(
      chatId,
      "❌ આ command ઉપલબ્ધ નથી.\n\nMenu માંથી option પસંદ કરો 👇",
      mainMenuKeyboard()
    )
  }
}
