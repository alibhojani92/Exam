import { sendMessage } from "../services/telegram"
import { mainMenuKeyboard } from "../keyboards/main.menu"

export async function handleMessage(ctx) {
  const { chatId, text } = ctx

  // Unknown text → show main menu
  if (text && !text.startsWith("/")) {
    await sendMessage(
      chatId,
      "ℹ️ Command સમજાઈ નથી.\n\nMenu માંથી option પસંદ કરો 👇",
      mainMenuKeyboard()
    )
  }
}
