import { getOrCreateUser } from "../db/user.repo"

/**
 * Telegram user sync
 */
export async function syncUser(env, telegramUser) {
  return await getOrCreateUser(env, telegramUser)
}
