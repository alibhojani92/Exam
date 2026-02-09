import { sendMessage } from "../services/telegram"

export async function handleGroup(ctx) {
  const { chatId, text, chatType } = ctx

  if (chatType !== "group" && chatType !== "supergroup") return

  // Allow exam in group
  if (text === "/exam") {
    await sendMessage(
      chatId,
      "📝 Group Exam start થશે.\n\nQuestion આવવા જઈ રહ્યો છે..."
    )
  }
}
