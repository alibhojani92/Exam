import { sendMessage } from "../services/telegram"
import { mainMenuKeyboard } from "../keyboards/main.menu"

export async function handleGroup(ctx) {
  const { chatId, text, chatType } = ctx

  // Safety: only group/supergroup
  if (chatType !== "group" && chatType !== "supergroup") return

  // Bot mention અથવા /start@BotUsername જેવી case
  if (text && (text.includes("/start") || text.includes("@"))) {
    await sendMessage(
      chatId,
      "👋 Group માં exam start થતું નથી.\n\n📝 Exam આપવા માટે bot ને private chat માં open કરો.",
      mainMenuKeyboard()
    )
  }
}
