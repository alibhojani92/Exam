import { editMessage } from "../services/telegram"
import { mainMenuKeyboard } from "../keyboards/main.menu"

export async function handleCallback(ctx) {
  const { chatId, chatType, data, messageId } = ctx

  // START EXAM button
  if (data === "START_EXAM") {
    const text =
      chatType === "private"
        ? "📝 Exam private chat માં start થશે.\n\n(Exam logic next step માં add કરીશું)"
        : "⚠️ Exam આપવા માટે bot ને private chat માં open કરો."

    await editMessage(chatId, messageId, text, mainMenuKeyboard())
    return
  }

  // MY RESULT button
  if (data === "MY_RESULT") {
    await editMessage(
      chatId,
      messageId,
      "📊 Result feature હજી develop થઈ રહ્યું છે.",
      mainMenuKeyboard()
    )
    return
  }
}
