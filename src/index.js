import { parseUpdate } from "./utils/parser"
import { sendMessage } from "./services/telegram"
import { handleCallback } from "./handlers/callback"
import { mainMenuKeyboard } from "./keyboards/main.menu"

export default {
  async fetch(request, env) {
    let update
globalThis.API_URL = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`
    try {
      update = await request.json()
    } catch (e) {
      return new Response("OK")
    }

    const ctx = parseUpdate(update)
    if (!ctx) return new Response("OK")

    // /start command (private + group)
    if (ctx.type === "message" && ctx.text === "/start") {
      await sendMessage(
        ctx.chatId,
        "👋 Welcome to MCQ Exam Bot\n\n📝 Exam start કરવા માટે button દબાવો",
        mainMenuKeyboard()
      )
    }
// /exam command (private + group)
if (ctx.type === "message" && ctx.text === "/exam") {
  await sendMessage(
    ctx.chatId,
    "📝 Exam start થઈ રહ્યો છે...\n\nFirst question લોડ થાય છે ⏳"
  )
}
    // Inline keyboard callbacks
    if (ctx.type === "callback") {
      await handleCallback(ctx)
    }

    return new Response("OK")
  }
}
