import { parseUpdate } from "./utils/parser"
import { handleCommand } from "./handlers/command"
import { handleCallback } from "./handlers/callback"

export default {
  async fetch(request, env) {
    // Telegram webhook safety
    if (request.method !== "POST") {
      return new Response("OK")
    }

    let update
    try {
      update = await request.json()
    } catch {
      return new Response("OK")
    }

    const ctx = parseUpdate(update)
    if (!ctx) return new Response("OK")

    // Commands
    if (ctx.type === "message" && ctx.text?.startsWith("/")) {
      await handleCommand(ctx, env)
    }

    // Inline callbacks (MCQ answers)
    if (ctx.type === "callback") {
      await handleCallback(ctx, env)
    }

    return new Response("OK")
  }
}
