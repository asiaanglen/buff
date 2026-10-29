const recent = new Map();
const INTERVAL = 5 * 60000;
export async function trackAccountActivity(db, userId, now = Date.now()) {
  if (!userId || (recent.has(userId) && now - recent.get(userId) < INTERVAL))
    return;
  try {
    await db
      .prepare(
        "UPDATE admin_account_activity SET last_active_at=? WHERE user_id=? AND (last_active_at IS NULL OR last_active_at<?)",
      )
      .bind(now, userId, now - INTERVAL)
      .run();
    recent.set(userId, now);
    if (recent.size > 5000) recent.delete(recent.keys().next().value);
  } catch {
    // Optional admin telemetry must never affect authentication or journal saves.
  }
}
