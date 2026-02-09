import { parseUpdate } from "./utils/parser"
import { handleCommand } from "./handlers/command"
import { handleCallback } from "./handlers/callback"

export default {
  async fetch(request, env) {
   console.log("🔥 INDEX.JS LOADED");
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

    // 🔥 ALWAYS allow commands
    if (ctx.type === "message") {
      await handleCommand(ctx, env)
      return new Response("OK")
    }

    if (ctx.type === "callback") {
      await handleCallback(ctx, env)
      return new Response("OK")
    }

    return new Response("OK")
  }
}
