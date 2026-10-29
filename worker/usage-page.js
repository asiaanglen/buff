import { identify } from "./session.js";
import { usageOwner, usageSummary } from "./usage.js";
import { page, signIn, escape as esc } from "./pages.js";
const number = (value) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    value || 0,
  );
const bytes = (value) =>
  value == null
    ? "Unavailable"
    : value >= 1000000
      ? `${(value / 1000000).toFixed(1)} MB`
      : `${Math.ceil(value / 1024)} KB`;
export function quotaWarnings(summary) {
  return [
    [
      "Estimated Buff requests",
      summary.estimates.requests,
      summary.limits.requests,
    ],
    [
      "Estimated app database reads",
      summary.estimates.reads,
      summary.limits.reads,
    ],
    [
      "Estimated app database writes",
      summary.estimates.writes,
      summary.limits.writes,
    ],
    ["Database storage", summary.databaseBytes, summary.limits.databaseBytes],
  ]
    .filter(([, value, limit]) => value != null && value >= limit * 0.7)
    .map(([label, value, limit]) => ({
      label,
      level: value >= limit * 0.9 ? "critical" : "warning",
      percent: Math.round((value / limit) * 100),
    }));
}
function renderUsage(data) {
  const warnings = quotaWarnings(data),
    todayEvents = data.events.filter((event) => event.day === data.day);
  const count = (event) =>
    todayEvents
      .filter((row) => row.event === event)
      .reduce((n, row) => n + row.count, 0);
  const active =
    data.activity.find((row) => row.day === data.day)?.active_users || 0;
  const metric = (label, value, description) =>
    `<article class="usage-card"><h2>${esc(label)}</h2><strong>${esc(value)}</strong><p>${esc(description)}</p></article>`;
  const quota = (label, value, limit, estimate = false) =>
    `<article class="usage-card"><h2>${esc(label)}</h2><strong>${value == null ? "Unavailable" : number(value)}</strong><p>of ${number(limit)}${estimate ? " · sampled estimate" : ""}</p>${value == null ? "" : `<meter min="0" max="${limit}" value="${Math.min(value, limit)}" aria-label="${esc(label)}"></meter>`}</article>`;
  const dates = Array.from({ length: data.days }, (_, i) =>
    new Date(Date.parse(data.day + "T00:00:00Z") - i * 86400000)
      .toISOString()
      .slice(0, 10),
  );
  return `<link rel="stylesheet" href="/usage.css"><div class="usage-toolbar"><p>Owner-only monitoring · <a href="/feedback/inbox">Feedback inbox</a></p><div><a class="secondary" href="/usage?days=7">7 days</a><a class="secondary" href="/usage?days=30">30 days</a><a class="secondary" href="/usage?days=${data.days}">Refresh</a></div></div><p>Quota day: <strong>${esc(data.day)} UTC</strong>. Daily quotas reset at 00:00 UTC. Tracking began ${esc(new Date(data.startedAt).toISOString())}.</p>${warnings.map((warning) => `<p class="usage-alert ${warning.level}" role="alert">${esc(warning.label)} has reached ${warning.percent}% of the Free-plan allowance. ${warning.level === "critical" ? "Check Cloudflare metrics now." : "Review usage before it reaches the limit."}</p>`).join("")}<section class="usage-grid">${metric("Registered accounts", number(data.registeredUsers), "Current account count")}${metric("Active users", number(active), "Distinct signed-in accounts today (UTC)")}${metric("New signups", number(count("signup_success")), "Successful signups today (UTC)")}${metric("Workouts completed", number(count("workout_completed")), "Completion actions today; undoing and completing again counts again")}</section><h2>Hosting usage</h2><p>These are Buff-only estimates from a ${Math.round(data.sampleRate * 100)}% request sample, not billing totals. Background monitoring writes and other Workers are excluded. An initial partial day is not a full day of usage.</p><section class="usage-grid">${quota("Backend requests", data.estimates.requests, data.limits.requests, true)}${quota("Database rows read", data.estimates.reads, data.limits.reads, true)}${quota("Database rows written", data.estimates.writes, data.limits.writes, true)}${metric("Database storage", bytes(data.databaseBytes), "500 MB Free-plan limit for this database")}</section><div class="usage-links"><a class="secondary" href="https://dash.cloudflare.com/8447d2f9fbf3e27878055f12eab784f8/workers/services/view/buff/production/metrics" target="_blank" rel="noopener noreferrer">Cloudflare traffic &amp; CPU errors ↗</a><a class="secondary" href="https://dash.cloudflare.com/8447d2f9fbf3e27878055f12eab784f8/workers/d1/databases/50c0fabf-368b-4cba-bf6c-138c861ec637" target="_blank" rel="noopener noreferrer">Cloudflare database metrics ↗</a></div><p>Use Cloudflare for account-wide quota totals and CPU-limit errors. A Worker stopped by the platform cannot reliably report its own failure here. Free CPU allowance: 10 ms per invocation; daily request allowance is shared across the account.</p><h2>Workout journal storage</h2><section class="usage-grid">${metric("Accounts near the limit", number(data.journals.near_limit), "Warning at 750 KB per journal")}${metric("Largest journal", bytes(data.journals.largest_journal), "App journal limit: 1 MB")}</section>${data.journals.near_limit ? '<p class="usage-alert warning" role="alert">Some accounts are approaching their workout-history storage limit. Those users see a storage warning in Buff.</p>' : ""}<h2>Daily activity (UTC)</h2><div class="usage-table"><table><thead><tr><th>Date</th><th>Active users</th><th>Signups</th><th>Completions</th><th>Failed saves/loads</th></tr></thead><tbody>${dates
    .map((day) => {
      const rows = data.events.filter((row) => row.day === day),
        n = (event) =>
          rows
            .filter((row) => row.event === event)
            .reduce((sum, row) => sum + row.count, 0);
      return `<tr><td>${esc(day)}</td><td>${number(data.activity.find((row) => row.day === day)?.active_users)}</td><td>${number(n("signup_success"))}</td><td>${number(n("workout_completed"))}</td><td>${number(n("sync_failed") + n("sync_network_failure"))}</td></tr>`;
    })
    .join(
      "",
    )}</tbody></table></div><h2>Recent issues</h2><p>Aggregated by UTC hour and category. Offline sync issues appear after the device reconnects.</p><div class="usage-table"><table><thead><tr><th>UTC hour</th><th>Category</th><th>Issue</th><th>Status</th><th>Count</th></tr></thead><tbody>${data.errors.map((row) => `<tr><td>${esc(row.hour)}</td><td>${esc(row.category)}</td><td>${esc(row.event.replaceAll("_", " "))}</td><td>${row.status || "Network"}</td><td>${number(row.count)}</td></tr>`).join("") || '<tr><td colspan="5">No reported issues in this period.</td></tr>'}</tbody></table></div><p class="usage-privacy">Monitoring stores aggregate counters and rotating daily account hashes. It does not store names, emails, birth dates, passwords, workout names, notes, request bodies, or raw URLs. Old metrics are cleaned in bounded batches as traffic arrives, targeting 30 days of history.</p>`;
}
export async function usagePage(request, env, asJson = false) {
  const user = await identify(request, env.DB);
  if (!user)
    return asJson
      ? Response.json({ error: "Sign in to view usage." }, { status: 401 })
      : signIn(request);
  if (!(await usageOwner(env.DB, user.id)))
    return asJson
      ? Response.json({ error: "Owner access is required." }, { status: 403 })
      : page(
          "Owner access required",
          "<p>This page is available only to the Buff owner.</p>",
          undefined,
          403,
        );
  const requested = Number(new URL(request.url).searchParams.get("days")),
    days = requested === 30 ? 30 : 7;
  const summary = await usageSummary(env.DB, days);
  summary.sampleRate = Math.max(
    0.01,
    Math.min(1, Number(env.USAGE_SAMPLE_RATE) || 0.05),
  );
  if (asJson)
    return Response.json(
      { ...summary, warnings: quotaWarnings(summary) },
      { headers: { "Cache-Control": "no-store" } },
    );
  return page("Usage dashboard", renderUsage(summary));
}
