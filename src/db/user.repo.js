import { getDB } from "./d1"

export async function getOrCreateUser(env, telegramUser) {
  const db = getDB(env)

  const telegramId = telegramUser.id
  const firstName = telegramUser.first_name || ""
  const username = telegramUser.username || ""

  // Check existing user
  const existing = await db
    .prepare("SELECT * FROM users WHERE telegram_id = ?")
    .bind(telegramId)
    .first()

  if (existing) {
    return existing
  }

  // Create new user
  const result = await db
    .prepare(
      "INSERT INTO users (telegram_id, first_name, username) VALUES (?, ?, ?)"
    )
    .bind(telegramId, firstName, username)
    .run()

  return {
    id: result.meta.last_row_id,
    telegram_id: telegramId,
    first_name: firstName,
    username: username
  }
}
