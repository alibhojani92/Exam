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

    // ALL messages → command handler
    if (ctx.type === "message") {
      await handleCommand(ctx, env)
      return new Response("OK")
    }

    // Inline keyboard callbacks
    if (ctx.type === "callback") {
      await handleCallback(ctx, env)
      return new Response("OK")
    }

    return new Response("OK")
  }
}
