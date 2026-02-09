export function getDB(env) {
  if (!env || !env.DB) {
    throw new Error("❌ D1 database binding (DB) મળ્યું નથી")
  }

  return env.DB
}
