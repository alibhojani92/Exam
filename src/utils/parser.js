export function parseUpdate(update) {
  if (update.message) {
    const rawText = update.message.text || ""

    return {
      type: "message",
      chatType: update.message.chat.type,
      chatId: update.message.chat.id,
      // 🔥 IMPORTANT FIX
      text: rawText.split("@")[0].trim(),
      from: update.message.from,
      messageId: update.message.message_id
    }
  }

  if (update.callback_query) {
    return {
      type: "callback",
      chatType: update.callback_query.message.chat.type,
      chatId: update.callback_query.message.chat.id,
      data: update.callback_query.data,
      from: update.callback_query.from,
      messageId: update.callback_query.message.message_id
    }
  }

  return null
}
