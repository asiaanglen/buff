import { identify } from "./session.js";
import { usageOwner } from "./usage.js";
import { page, signIn, sameOrigin, escape as esc } from "./pages.js";
import { randomHex } from "./crypto.js";

async function formBody(request) {
  if (
    !request.headers
      .get("Content-Type")
      ?.startsWith("application/x-www-form-urlencoded")
  )
    throw Error("Open the feedback form and try again.");
  const reader = request.body?.getReader();
  if (!reader) throw Error("Enter your feedback first.");
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 65536) {
      await reader.cancel();
      throw Error("Your report is too long. Please shorten it and try again.");
    }
    chunks.push(value);
  }
  const data = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  return Object.fromEntries(
    new URLSearchParams(new TextDecoder().decode(data)),
  );
}
const safePath = (value) =>
  ["/", "/app", "/coach", "/connections", "/feedback"].includes(value)
    ? value
    : "";
function reportForm(user, input = {}, error = "", status = 200) {
  const id = /^[a-f0-9]{32}$/.test(input.id || "") ? input.id : randomHex(16);
  return page(
    "Give feedback / Report a bug",
    `<p>Tell us what could be better, or what went wrong. Your report goes privately to Buff’s owner.</p><p>Submitting as <strong>${esc(user.email)}</strong>. Your account is linked so the owner can follow up with you.</p>${error ? `<p class="warning" role="alert">${esc(error)}</p>` : ""}<form method="post" action="/feedback" class="feedback-form"><input type="hidden" name="id" value="${id}"><input type="hidden" name="page" value="${esc(safePath(input.page))}"><label for="feedback-kind">What would you like to share?</label><select id="feedback-kind" name="kind"><option value="feedback" ${input.kind !== "bug" ? "selected" : ""}>Feedback or a feature idea</option><option value="bug" ${input.kind === "bug" ? "selected" : ""}>Report a bug</option></select><label for="feedback-message">Your feedback or what went wrong</label><textarea id="feedback-message" name="message" rows="6" maxlength="3000" required placeholder="What happened? What would you like to see?">${esc(input.message || "")}</textarea><label for="feedback-steps">Steps to reproduce <span class="badge">optional</span></label><textarea id="feedback-steps" name="steps" rows="4" maxlength="2000" placeholder="Where were you in Buff? What did you tap, and what did you expect?">${esc(input.steps || "")}</textarea><label class="feedback-diagnostics"><input type="checkbox" name="diagnostics" value="yes" ${input.diagnostics === undefined || input.diagnostics === "yes" ? "checked" : ""}> Include browser/device details to help diagnose the issue</label><p class="badge">If selected, we include your browser version and the Buff page you came from. We do not automatically include workout history, passwords, or invitation links. Please leave passwords and other sensitive details out of your message.</p><button type="submit">Send feedback</button></form><p><a href="/coach">Back to coach portal</a></p>`,
    undefined,
    status,
  );
}
async function inbox(request, env, user) {
  if (!(await usageOwner(env.DB, user.id)))
    return page(
      "Not found",
      "<p>This page is unavailable.</p>",
      undefined,
      404,
    );
  if (request.method === "POST") {
    if (!sameOrigin(request))
      return page(
        "Request rejected",
        "<p>Open the inbox again and retry.</p>",
        undefined,
        403,
      );
    let form;
    try {
      form = await formBody(request);
    } catch (e) {
      return page("Invalid form", `<p>${esc(e.message)}</p>`, undefined, 400);
    }
    if (
      !/^[a-f0-9]{32}$/.test(form.id || "") ||
      !["open", "resolved"].includes(form.status)
    )
      return page(
        "Invalid update",
        "<p>Choose a report from the inbox.</p>",
        undefined,
        400,
      );
    await env.DB.prepare(
      "UPDATE feedback_reports SET status=?,updated=? WHERE id=?",
    )
      .bind(form.status, Date.now(), form.id)
      .run();
    return Response.redirect(new URL("/feedback/inbox", request.url), 303);
  }
  if (request.method !== "GET")
    return new Response("Method not allowed", { status: 405 });
  const before =
    Number(new URL(request.url).searchParams.get("before")) || Date.now() + 1;
  const reports = (
    await env.DB.prepare(
      "SELECT r.*,u.email,u.first_name,u.last_name FROM feedback_reports r LEFT JOIN users u ON u.id=r.user_id WHERE r.created<? ORDER BY r.created DESC LIMIT 100",
    )
      .bind(before)
      .all()
  ).results;
  return page(
    "Feedback inbox",
    `<p>Owner-only feedback and bug reports. Resolve items when handled; reopening keeps the original report.</p>${reports.map((r) => `<article class="feedback-report"><span class="badge">${r.kind === "bug" ? "Bug report" : "Feedback"} · ${r.status === "resolved" ? "Resolved" : "Open"} · ${esc(new Date(r.created).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }))}</span><h2>${esc([r.first_name, r.last_name].filter(Boolean).join(" ") || "Buff user")}</h2><p>${esc(r.email || "Account removed")}</p><div class="feedback-message">${esc(r.message)}</div>${r.steps ? `<h3>Steps to reproduce</h3><div class="feedback-message">${esc(r.steps)}</div>` : ""}${r.browser ? `<p class="badge">Browser: ${esc(r.browser)}</p><p class="badge">Page: ${esc(r.source_path || "/")}</p>` : ""}<form method="post" action="/feedback/inbox"><input type="hidden" name="id" value="${r.id}"><button class="secondary" name="status" value="${r.status === "open" ? "resolved" : "open"}">${r.status === "open" ? "Mark resolved" : "Reopen report"}</button></form></article>`).join("") || "<p>No feedback yet.</p>"}${reports.length === 100 ? `<p><a href="/feedback/inbox?before=${reports.at(-1).created}">Older reports →</a></p>` : ""}<p><a href="/usage">Usage dashboard</a></p>`,
  );
}
export async function feedbackPage(request, env) {
  const user = await identify(request, env.DB);
  if (!user) return signIn(request);
  const path = new URL(request.url).pathname;
  if (path === "/feedback/inbox") return inbox(request, env, user);
  if (path === "/feedback/thanks")
    return page(
      "Thanks for your feedback",
      '<p role="status">Your report has been sent to Buff’s private feedback inbox.</p><p><a href="/feedback">Send more feedback</a> · <a href="/coach">Back to coach portal</a></p>',
    );
  if (path !== "/feedback")
    return page("Not found", "<p>Page not found.</p>", undefined, 404);
  if (request.method === "GET") {
    let source = "";
    try {
      const ref = new URL(request.headers.get("Referer"));
      if (ref.origin === new URL(request.url).origin)
        source = safePath(ref.pathname);
    } catch {}
    return reportForm(user, { page: source });
  }
  if (request.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  if (!sameOrigin(request))
    return page(
      "Request rejected",
      "<p>Open the feedback form again and retry.</p>",
      undefined,
      403,
    );
  let input;
  try {
    input = await formBody(request);
  } catch (e) {
    return reportForm(user, {}, e.message, 400);
  }
  input.diagnostics ||= "no";
  const message = (input.message || "").trim(),
    steps = (input.steps || "").trim();
  if (
    !/^[a-f0-9]{32}$/.test(input.id || "") ||
    !["feedback", "bug"].includes(input.kind) ||
    !message ||
    message.length > 3000 ||
    steps.length > 2000
  )
    return reportForm(
      user,
      input,
      "Choose a report type and enter a message (up to 3,000 characters). Reproduction steps can be up to 2,000 characters.",
      400,
    );
  const source = safePath(input.page);
  const browser =
    input.diagnostics === "yes"
      ? (request.headers.get("User-Agent") || "").slice(0, 500)
      : "";
  const now = Date.now();
  const result = await env.DB.prepare(
    "INSERT INTO feedback_reports(id,user_id,kind,message,steps,browser,source_path,created,updated) SELECT ?,?,?,?,?,?,?,?,? WHERE (SELECT count(*) FROM feedback_reports WHERE user_id=? AND created>?)<10 ON CONFLICT(id) DO NOTHING RETURNING id",
  )
    .bind(
      input.id,
      user.id,
      input.kind,
      message,
      steps,
      browser,
      input.diagnostics === "yes" ? source : "",
      now,
      now,
      user.id,
      now - 86400000,
    )
    .first();
  if (
    !result &&
    !(await env.DB.prepare(
      "SELECT id FROM feedback_reports WHERE id=? AND user_id=?",
    )
      .bind(input.id, user.id)
      .first())
  )
    return reportForm(
      user,
      input,
      "You’ve sent 10 reports in the past 24 hours. Please try again later.",
      429,
    );
  return Response.redirect(new URL("/feedback/thanks", request.url), 303);
}
