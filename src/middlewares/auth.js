/**
 * Simple auth middleware
 * Future admin checks માટે base
 */

// Telegram user ID list (admin)
const ADMINS = [] // example: [123456789]

export function isAdmin(telegramUserId) {
  return ADMINS.includes(telegramUserId)
}
