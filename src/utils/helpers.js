export function isPrivate(chatType) {
  return chatType === "private"
}

export function isGroup(chatType) {
  return chatType === "group" || chatType === "supergroup"
}
