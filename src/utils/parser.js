export function parseUpdate(update) {
  // Normal message
  if (update.message) {
    return {
      type: "message",
      chatType: update.message.chat.type, // private | group | supergroup
      chatId: update.message.chat.id,
      text: update.message.text || "",
      from: update.message.from,
      messageId: update.message.message_id
    }
  }

  // Inline keyboard callback
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
