import { identify } from "./session.js";
import { usageOwner, usageSummary } from "./usage.js";
import { page, signIn, escape as esc } from "./pages.js";
const number = (value) => new Intl.NumberFormat("en-US").format(value || 0);
const date = (value) =>
  value
    ? new Date(value).toLocaleString("en-US", {
        timeZone: "America/Los_Angeles",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : "Not recorded";
export async function adminSummary(
  db,
  { days = 7, query = "", pageNumber = 1, now = Date.now() } = {},
) {
  days = days === 30 ? 30 : 7;
  pageNumber = Math.max(
    1,
    Math.min(10000, Math.trunc(Number(pageNumber)) || 1),
  );
  query = String(query).trim().slice(0, 100);
  const where =
    "(instr(lower(u.email),lower(?))>0 OR instr(lower(coalesce(u.first_name,'')||' '||coalesce(u.last_name,'')),lower(?))>0)";
  const rows = await db.batch([
    db.prepare("SELECT started_at FROM admin_settings WHERE id=1"),
    db
      .prepare(
        "SELECT (SELECT count(*) FROM users) AS accounts,(SELECT count(*) FROM coach_profiles) AS coaches,(SELECT count(DISTINCT client_id) FROM coaching_assignments WHERE revoked IS NULL) AS clients,(SELECT count(*) FROM admin_account_activity WHERE last_active_at>=?) AS active24h,(SELECT count(*) FROM admin_account_activity WHERE last_active_at>=?) AS activePeriod,(SELECT count(*) FROM feedback_reports WHERE status='open') AS openFeedback",
      )
      .bind(now - 86400000, now - days * 86400000),
    db.prepare(
      "SELECT coalesce(sum(json_array_length(data,'$.programs')),0) AS programs,(SELECT count(*) FROM journals j,json_each(j.data,'$.workouts') w WHERE EXISTS(SELECT 1 FROM json_each(w.value,'$.exercises') e,json_each(e.value,'$.logs') l) AND NOT EXISTS(SELECT 1 FROM json_each(w.value,'$.exercises') e,json_each(e.value,'$.logs') l WHERE json_extract(l.value,'$.done') IS NOT 1)) AS completedWorkouts FROM journals",
    ),
    db
      .prepare(`SELECT count(*) AS total FROM users u WHERE ${where}`)
      .bind(query, query),
    db
      .prepare(
        `SELECT u.id,u.email,u.first_name,u.last_name,a.registered_at,a.last_active_at,EXISTS(SELECT 1 FROM coach_profiles c WHERE c.user_id=u.id) AS isCoach,(SELECT count(*) FROM coaching_assignments c WHERE c.client_id=u.id AND c.revoked IS NULL) AS coachingPrograms,coalesce(json_array_length(j.data,'$.programs'),0) AS programs,(SELECT count(*) FROM json_each(j.data,'$.workouts') w WHERE EXISTS(SELECT 1 FROM json_each(w.value,'$.exercises') e,json_each(e.value,'$.logs') l) AND NOT EXISTS(SELECT 1 FROM json_each(w.value,'$.exercises') e,json_each(e.value,'$.logs') l WHERE json_extract(l.value,'$.done') IS NOT 1)) AS completedWorkouts FROM users u LEFT JOIN admin_account_activity a ON a.user_id=u.id LEFT JOIN journals j ON j.user_id=u.id WHERE ${where} ORDER BY a.registered_at DESC,u.id LIMIT 50 OFFSET ?`,
      )
      .bind(query, query, (pageNumber - 1) * 50),
    db.prepare(
      "SELECT r.id,r.kind,r.status,r.created,u.email,u.first_name,u.last_name FROM feedback_reports r LEFT JOIN users u ON u.id=r.user_id ORDER BY r.created DESC LIMIT 5",
    ),
  ]);
  const usage = await usageSummary(db, days, now);
  const totals = rows[1].results[0];
  const day = new Date(now).toISOString().slice(0, 10);
  const since = new Date(now - (days - 1) * 86400000)
    .toISOString()
    .slice(0, 10);
  const daily = [];
  for (let i = 0; i < days; i++) {
    const key = new Date(Date.parse(day + "T00:00:00Z") - i * 86400000)
      .toISOString()
      .slice(0, 10);
    const count = (name) =>
      usage.events
        .filter((e) => e.day === key && e.event === name)
        .reduce((sum, e) => sum + e.count, 0);
    daily.push({
      day: key,
      active: usage.activity.find((a) => a.day === key)?.active_users || 0,
      signups: count("signup_success"),
      signins: count("signin_success"),
      completed: count("workout_completed"),
      issues:
        count("sync_failed") +
        count("sync_network_failure") +
        count("server_error"),
    });
  }
  return {
    days,
    query,
    pageNumber,
    trackingStartedAt: rows[0].results[0]?.started_at,
    usageStartedAt: usage.startedAt,
    totals: {
      ...totals,
      ...rows[2].results[0],
      signups: daily.reduce((s, d) => s + d.signups, 0),
      completions: daily.reduce((s, d) => s + d.completed, 0),
    },
    users: rows[4].results,
    totalUsers: rows[3].results[0].total,
    recentFeedback: rows[5].results,
    daily,
    since,
  };
}
function render(data) {
  const link = (pageNumber, days = data.days) =>
    "/admin?" +
    new URLSearchParams({
      days: String(days),
      q: data.query,
      page: String(pageNumber),
    });
  const card = (label, value, help) =>
    `<article class="usage-card"><h2>${esc(label)}</h2><strong>${number(value)}</strong><p>${esc(help)}</p></article>`;
  const cards = [
    card("Registered users", data.totals.accounts, "All current accounts"),
    card(
      "New signups",
      data.totals.signups,
      `In the displayed ${data.days} UTC calendar days`,
    ),
    card(
      "Active users · 24h",
      data.totals.active24h,
      "Signed-in activity; timestamps refresh about every 5 minutes",
    ),
    card(
      "Workout completions",
      data.totals.completions,
      `Completion actions in ${data.days} UTC days; undo/recomplete can count again`,
    ),
    card("Coaches", data.totals.coaches, "Self-registered coach profiles"),
    card(
      "Coached clients",
      data.totals.clients,
      "Distinct clients with an active coaching connection",
    ),
    card(
      "Programs",
      data.totals.programs,
      "Program copies across all user journals",
    ),
    card(
      "Open feedback",
      data.totals.openFeedback,
      "Feedback and bug reports waiting to be resolved",
    ),
  ].join("");
  const max = Math.max(1, ...data.daily.map((d) => d.active));
  return `<link rel="stylesheet" href="/usage.css"><div class="usage-toolbar"><p>Owner-only admin dashboard</p><div><a class="secondary" href="${esc(link(1, 7))}">7 days</a><a class="secondary" href="${esc(link(1, 30))}">30 days</a><a class="secondary" href="${esc(link(data.pageNumber))}">Refresh</a></div></div><nav class="usage-links" aria-label="Admin tools"><a href="#admin-users">Users &amp; signups</a><a href="#admin-activity">Activity</a><a href="/feedback/inbox">Feedback inbox</a><a href="/usage">Hosting &amp; error monitoring</a></nav><section class="usage-grid">${cards}</section><section id="admin-activity"><h2>Daily activity</h2><p>UTC calendar days, using existing aggregate monitoring history. Monitoring began ${esc(date(data.usageStartedAt))}. Zero means no recorded activity; counts are not page views.</p><div class="admin-chart" role="img" aria-label="Daily active users for the displayed period; exact counts are in the table below">${[
    ...data.daily,
  ]
    .reverse()
    .map(
      (d) =>
        `<div class="admin-chart-row"><span>${esc(d.day.slice(5))}</span><meter min="0" max="${max}" value="${d.active}" aria-label="${d.day} active users">${d.active}</meter><strong>${number(d.active)}</strong></div>`,
    )
    .join(
      "",
    )}</div><div class="usage-table"><table><thead><tr><th>Date (UTC)</th><th>Active users</th><th>Signups</th><th>Sign-ins</th><th>Completions</th><th>Sync/server issues</th></tr></thead><tbody>${data.daily.map((d) => `<tr><td>${esc(d.day)}</td><td>${number(d.active)}</td><td>${number(d.signups)}</td><td>${number(d.signins)}</td><td>${number(d.completed)}</td><td>${number(d.issues)}</td></tr>`).join("")}</tbody></table></div></section><section id="admin-users"><h2>Users &amp; new signups</h2><p>Newest recorded signups appear first. Individual signup and last-active timestamps are tracked starting ${esc(date(data.trackingStartedAt))}; earlier dates are shown as “Not recorded.” Times below are Pacific time. Last active reflects authenticated requests, not an exact online/offline status.</p><form method="get" action="/admin" class="admin-search"><input type="hidden" name="days" value="${data.days}"><label for="admin-user-query">Find a user by name or email</label><div><input id="admin-user-query" name="q" maxlength="100" value="${esc(data.query)}" placeholder="Search users"><button type="submit">Search</button><a href="/admin?days=${data.days}">Clear</a></div></form><p>${number(data.totalUsers)} matching accounts · Page ${data.pageNumber}</p><div class="usage-table"><table><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Signed up</th><th>Last active</th><th>Programs</th><th>Completed workouts</th></tr></thead><tbody>${data.users.map((u) => `<tr><td>${esc([u.first_name, u.last_name].filter(Boolean).join(" ") || "Name not set")}</td><td>${esc(u.email)}</td><td>${u.isCoach ? "Coach" : u.coachingPrograms ? "Coached client" : "Member"}${u.isCoach && u.coachingPrograms ? " · Coached client" : ""}</td><td>${esc(date(u.registered_at))}</td><td>${esc(date(u.last_active_at))}</td><td>${number(u.programs)}</td><td>${number(u.completedWorkouts)}</td></tr>`).join("") || '<tr><td colspan="7">No matching users.</td></tr>'}</tbody></table></div><nav class="usage-links" aria-label="User list pages">${data.pageNumber > 1 ? `<a href="${esc(link(data.pageNumber - 1))}">← Previous</a>` : ""}${data.pageNumber * 50 < data.totalUsers ? `<a href="${esc(link(data.pageNumber + 1))}">Next →</a>` : ""}</nav></section><section><h2>Recent feedback</h2>${data.recentFeedback.map((r) => `<article class="admin-feedback"><strong>${r.kind === "bug" ? "Bug report" : "Feedback"} · ${r.status === "open" ? "Open" : "Resolved"}</strong><p>${esc([r.first_name, r.last_name].filter(Boolean).join(" ") || r.email || "Account removed")} · ${esc(date(r.created))}</p></article>`).join("") || "<p>No feedback yet.</p>"}<a href="/feedback/inbox">Review feedback and bug reports →</a></section><p class="usage-privacy">This dashboard is restricted to the existing owner account. It shows account details and activity summaries, without exposing passwords, dates of birth, workout names, exercise notes, or invitation links. Aggregate metrics retain the existing 30-day monitoring window.</p>`;
}
export async function adminPage(request, env, asJson = false) {
  const user = await identify(request, env.DB);
  const json = (body, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!user)
    return asJson
      ? json({ error: "Sign in to view the dashboard." }, 401)
      : signIn(request);
  if (!(await usageOwner(env.DB, user.id)))
    return asJson
      ? json({ error: "Owner access is required." }, 403)
      : page(
          "Owner access required",
          "<p>This dashboard is available only to the Buff owner.</p>",
          undefined,
          403,
        );
  if (request.method !== "GET")
    return new Response("Method not allowed", {
      status: 405,
      headers: { "Cache-Control": "no-store" },
    });
  const params = new URL(request.url).searchParams;
  const summary = await adminSummary(env.DB, {
    days: Number(params.get("days")),
    query: params.get("q") || "",
    pageNumber: params.get("page"),
  });
  return asJson ? json(summary) : page("Admin dashboard", render(summary));
}
