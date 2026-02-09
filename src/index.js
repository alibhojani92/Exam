import { parseUpdate } from "./utils/parser"
import { handleCommand } from "./handlers/command"
import { handleCallback } from "./handlers/callback"

export default {
  async fetch(request, env) {
    console.log("🔥 WORKER HIT");
    // Telegram webhook safety
    if (request.method !== "POST") {
      return new Response("OK")
    }

    let update
    try {
      update = await request.json()
    } catch (e) {
      return new Response("OK")
    }

    const ctx = parseUpdate(update)
    if (!ctx) return new Response("OK")

    // ✅ COMMANDS (/start, /exam)
    if (ctx.type === "message" && ctx.text) {
      await handleCommand(ctx, env)
      return new Response("OK")
    }

    // ✅ CALLBACKS (MCQ answers)
    if (ctx.type === "callback") {
      await handleCallback(ctx, env)
      return new Response("OK")
    }

    return new Response("OK")
  }
}
