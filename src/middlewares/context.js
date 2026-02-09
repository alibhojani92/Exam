/**
 * Context middleware
 * update + env ને single object માં bind કરે
 */
export function buildContext(update, env) {
  return {
    update,
    env
  }
}
