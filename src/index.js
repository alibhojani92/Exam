export default {
  async fetch(request, env) {
    return new Response("HELLO FROM WORKER", {
      headers: { "content-type": "text/plain" }
    })
  }
}
