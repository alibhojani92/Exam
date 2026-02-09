import { parseUpdate } from "./utils/parser"
import { sendMessage } from "./services/telegram"
import { handleCallback } from "./handlers/callback"
import { mainMenuKeyboard } from "./keyboards/main.menu"

export default {
  async fetch(request, env) {
    let update

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

    // Inline keyboard callbacks
    if (ctx.type === "callback") {
      await handleCallback(ctx)
    }

    return new Response("OK")
  }
}
