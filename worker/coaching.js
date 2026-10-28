import { identify } from "./session.js";
import { digest, randomHex } from "./crypto.js";
import {
  snapshotProgram,
  copySharedProgram,
} from "../shared/program-sharing.js";
import { inPounds } from "../shared/weights.js";
import {
  applyCoachLog,
  personName,
  programProgress,
} from "../shared/coaching.js";
import { journalCompleted } from "./usage.js";
const json = (value, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
async function body(request, max = 300000) {
  const reader = request.body?.getReader();
  if (!reader) throw { status: 400, message: "Missing request body." };
  let size = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw { status: 413, message: "Request is too large." };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.length;
  }
  try {
    const v = JSON.parse(new TextDecoder().decode(bytes));
    if (!v || typeof v !== "object" || Array.isArray(v)) throw Error();
    return v;
  } catch {
    throw { status: 400, message: "Enter valid JSON." };
  }
}
async function journal(db, id) {
  const r = await db
    .prepare("SELECT data,revision FROM journals WHERE user_id=?")
    .bind(id)
    .first();
  return {
    state: r
      ? inPounds(JSON.parse(r.data))
      : { version: 1, unit: "lbs", programs: [], workouts: [] },
    revision: r?.revision || 0,
    raw: r?.data,
  };
}
async function assignment(db, id) {
  return db
    .prepare("SELECT * FROM coaching_assignments WHERE id=?")
    .bind(id)
    .first();
}
const openInvite =
  "revoked IS NULL AND accepted_by IS NULL AND assignment_id IS NULL AND expires>?";
function scoped(state, id) {
  const program = state.programs?.find((p) => p.id === id);
  const workouts = state.workouts.filter((w) => w.programId === id);
  return {
    program: program || null,
    workouts,
    progress: programProgress(workouts),
  };
}
export async function coachingApi(request, env) {
  const url = new URL(request.url),
    path = url.pathname,
    method = request.method,
    db = env.DB;
  if (
    !["GET", "HEAD", "OPTIONS"].includes(method) &&
    request.headers.get("Origin") !== (env.PUBLIC_ORIGIN || url.origin)
  )
    return json({ error: "Request origin is not allowed." }, 403);
  const match = path.match(
    /^\/api\/coaching\/invites\/([a-f0-9]{64})(\/accept)?$/,
  );
  if (match && !match[2] && method === "GET") {
    const r = await db
      .prepare(
        "SELECT i.*,u.first_name,u.last_name FROM coach_invites i JOIN users u ON u.id=i.coach_id WHERE token_hash=? AND revoked IS NULL AND expires>?",
      )
      .bind(await digest(match[1]), Date.now())
      .first();
    if (!r)
      return json(
        {
          error:
            "This invitation expired or was disabled. Ask your coach for a new link.",
        },
        404,
      );
    const s = JSON.parse(r.snapshot);
    return json({
      coachName: personName({ firstName: r.first_name, lastName: r.last_name }),
      programName: s.program.name,
      weeks: s.program.weeks,
      workoutCount: s.workouts.length,
      emailRestricted: Boolean(r.client_email),
      accepted: Boolean(r.accepted_by),
      expires: r.expires,
    });
  }
  const user = await identify(request, db);
  if (!user || user.profileRequired)
    return json(
      { error: "Sign in and complete your profile to use coaching." },
      401,
    );
  if (path === "/api/coaching/profile" && method === "POST") {
    await db
      .prepare(
        "INSERT INTO coach_profiles(user_id,created) VALUES(?,?) ON CONFLICT(user_id) DO NOTHING",
      )
      .bind(user.id, Date.now())
      .run();
    return json({ isCoach: true });
  }
  if (path === "/api/coaching/access" && method === "GET") {
    const r = await db
      .prepare(
        "SELECT id,program_id,program_name,coach_name,created,updated,revoked FROM coaching_assignments WHERE client_id=? ORDER BY created DESC LIMIT 200",
      )
      .bind(user.id)
      .all();
    return json({ assignments: r.results });
  }
  const access = path.match(/^\/api\/coaching\/access\/([a-f0-9]{32})$/);
  if (access && method === "DELETE") {
    const r = await db
      .prepare(
        "UPDATE coaching_assignments SET revoked=? WHERE id=? AND client_id=? AND revoked IS NULL",
      )
      .bind(Date.now(), access[1], user.id)
      .run();
    return r.meta.changes
      ? json({ ok: true })
      : json({ error: "Active coaching connection not found." }, 404);
  }
  if (match?.[2] && method === "POST") {
    const input = await body(request, 4096);
    if (input.allowCoachLogging !== true)
      return json(
        {
          error:
            "Confirm that your coach can view and log results for this program.",
        },
        400,
      );
    const hash = await digest(match[1]);
    for (let attempt = 0; attempt < 3; attempt++) {
      const invite = await db
        .prepare(
          "SELECT i.*,u.first_name,u.last_name FROM coach_invites i JOIN users u ON u.id=i.coach_id WHERE token_hash=? AND revoked IS NULL AND expires>?",
        )
        .bind(hash, Date.now())
        .first();
      if (!invite)
        return json(
          { error: "This coaching invitation expired or was disabled." },
          404,
        );
      if (invite.coach_id === user.id)
        return json(
          {
            error:
              "Send this invitation to a client. You cannot accept your own invitation.",
          },
          400,
        );
      if (
        invite.client_email &&
        invite.client_email !== user.email.toLowerCase()
      )
        return json(
          {
            error:
              "This invitation is for a different email address. Sign in using the email your coach invited.",
          },
          403,
        );
      if (invite.assignment_id && !invite.accepted_by)
        return json(
          {
            error: "This invitation has already been used. Ask for a new link.",
          },
          410,
        );
      if (invite.accepted_by) {
        if (invite.accepted_by !== user.id)
          return json(
            {
              error: "This invitation was already accepted by another client.",
            },
            409,
          );
        const a = await assignment(db, invite.assignment_id),
          current = await journal(db, user.id);
        if (
          !a ||
          a.revoked ||
          !current.state.programs?.some((p) => p.id === a.program_id)
        )
          return json(
            {
              error:
                "This coaching connection ended or the program was removed. Ask for a new invitation.",
            },
            410,
          );
        return json({
          programId: a.program_id,
          assignmentId: a.id,
          alreadyImported: true,
        });
      }
      const current = await journal(db, user.id);
      let copied;
      try {
        copied = copySharedProgram(
          current.state,
          JSON.parse(invite.snapshot),
          input.startDate,
        );
      } catch (e) {
        return json({ error: e.message }, 400);
      }
      copied.state.programs.find((p) => p.id === copied.programId).unenrolled =
        true;
      const id = randomHex(16),
        now = Date.now(),
        data = JSON.stringify(copied.state),
        revision = current.revision + 1;
      const guard = `EXISTS(SELECT 1 FROM coach_invites WHERE id=? AND ${openInvite})`;
      const write =
        current.revision === 0
          ? db
              .prepare(
                `INSERT INTO journals(user_id,revision,data) SELECT ?,1,? WHERE ${guard} ON CONFLICT(user_id) DO NOTHING`,
              )
              .bind(user.id, data, invite.id, now)
          : db
              .prepare(
                `UPDATE journals SET data=?,revision=revision+1 WHERE user_id=? AND revision=? AND ${guard}`,
              )
              .bind(data, user.id, current.revision, invite.id, now);
      const receipt = db
        .prepare(
          "INSERT INTO coaching_assignments(id,invitation_id,coach_id,client_id,program_id,source_program_id,program_name,client_name,client_email,coach_name,created,updated) SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM journals WHERE user_id=? AND revision=? AND json_extract(data,?)=?) AND EXISTS(SELECT 1 FROM coach_invites WHERE id=? AND accepted_by IS NULL AND revoked IS NULL AND expires>?) ON CONFLICT(invitation_id) DO NOTHING",
        )
        .bind(
          id,
          invite.id,
          invite.coach_id,
          user.id,
          copied.programId,
          invite.source_program_id,
          JSON.parse(invite.snapshot).program.name,
          personName(user, "Client"),
          user.email,
          personName({
            firstName: invite.first_name,
            lastName: invite.last_name,
          }),
          now,
          now,
          user.id,
          revision,
          `$.programs[${copied.state.programs.length - 1}].id`,
          copied.programId,
          invite.id,
          now,
        );
      const claim = db
        .prepare(
          "UPDATE coach_invites SET accepted_by=?,assignment_id=? WHERE id=? AND EXISTS(SELECT 1 FROM coaching_assignments WHERE id=?)",
        )
        .bind(user.id, id, invite.id, id);
      await db.batch([write, receipt, claim]);
      const result = await db
        .prepare(
          "SELECT id,program_id FROM coaching_assignments WHERE invitation_id=? AND client_id=?",
        )
        .bind(invite.id, user.id)
        .first();
      if (result)
        return json(
          { programId: result.program_id, assignmentId: result.id },
          201,
        );
    }
    return json(
      { error: "Your journal changed while joining. Try again." },
      409,
    );
  }
  const coach = await db
    .prepare("SELECT user_id FROM coach_profiles WHERE user_id=?")
    .bind(user.id)
    .first();
  if (path === "/api/coaching" && method === "GET") {
    if (!coach)
      return json({ isCoach: false, assignments: [], invitations: [] });
    const r = await db
      .prepare(
        `SELECT a.id,a.program_id,a.program_name,a.client_name,a.client_email,a.created,a.updated,a.revoked,
   EXISTS(SELECT 1 FROM json_each(j.data,'$.programs') p WHERE json_extract(p.value,'$.id')=a.program_id) AS program_exists,
   (SELECT count(*) FROM json_each(j.data,'$.workouts') w WHERE json_extract(w.value,'$.programId')=a.program_id) AS workouts,
   (SELECT count(*) FROM json_each(j.data,'$.workouts') w WHERE json_extract(w.value,'$.programId')=a.program_id AND EXISTS(SELECT 1 FROM json_each(w.value,'$.exercises') e,json_each(e.value,'$.logs') l) AND NOT EXISTS(SELECT 1 FROM json_each(w.value,'$.exercises') e,json_each(e.value,'$.logs') l WHERE json_extract(l.value,'$.done') IS NOT 1)) AS completed,
   (SELECT count(*) FROM json_each(j.data,'$.workouts') w,json_each(w.value,'$.exercises') e,json_each(e.value,'$.logs') l WHERE json_extract(w.value,'$.programId')=a.program_id) AS sets,
   (SELECT count(*) FROM json_each(j.data,'$.workouts') w,json_each(w.value,'$.exercises') e,json_each(e.value,'$.logs') l WHERE json_extract(w.value,'$.programId')=a.program_id AND json_extract(l.value,'$.done')=1) AS sets_done
   FROM coaching_assignments a LEFT JOIN journals j ON j.user_id=a.client_id AND a.revoked IS NULL WHERE a.coach_id=? ORDER BY a.created DESC LIMIT 200`,
      )
      .bind(user.id)
      .all();
    const invites = await db
      .prepare(
        "SELECT id,source_program_id,client_email,created,expires,json_extract(snapshot,'$.program.name') AS programName FROM coach_invites WHERE coach_id=? AND revoked IS NULL AND accepted_by IS NULL AND assignment_id IS NULL AND expires>? ORDER BY created DESC LIMIT 50",
      )
      .bind(user.id, Date.now())
      .all();
    return json({
      isCoach: true,
      assignments: r.results,
      invitations: invites.results,
    });
  }
  if (!coach) return json({ error: "Create a coach profile first." }, 403);
  if (path === "/api/coaching/invites" && method === "POST") {
    const input = await body(request, 4096);
    if (
      typeof input.programId !== "string" ||
      input.programId.length > 100 ||
      (input.email !== undefined && typeof input.email !== "string")
    )
      return json(
        { error: "Choose a program and enter a valid email if needed." },
        400,
      );
    const email = input.email?.trim().toLowerCase() || null;
    if (
      email &&
      (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    )
      return json(
        {
          error:
            "Enter a valid client email or leave it blank for a text invitation.",
        },
        400,
      );
    const count = await db
      .prepare(
        `SELECT count(*) AS count FROM coach_invites WHERE coach_id=? AND ${openInvite}`,
      )
      .bind(user.id, Date.now())
      .first();
    if (count.count >= 50)
      return json(
        {
          error:
            "Disable an old pending invitation before creating another (50 active invitations maximum).",
        },
        400,
      );
    const current = await journal(db, user.id);
    let snapshot;
    try {
      snapshot = snapshotProgram(current.state, input.programId);
    } catch {
      return json(
        {
          error: "Save a program in your own library before inviting a client.",
        },
        404,
      );
    }
    if (!snapshot.workouts.length)
      return json(
        { error: "Add workouts to this program before inviting a client." },
        400,
      );
    const token = randomHex(),
      id = randomHex(16),
      now = Date.now();
    await db
      .prepare(
        "INSERT INTO coach_invites(id,token_hash,coach_id,source_program_id,snapshot,client_email,created,expires) VALUES(?,?,?,?,?,?,?,?)",
      )
      .bind(
        id,
        await digest(token),
        user.id,
        input.programId,
        JSON.stringify(snapshot),
        email,
        now,
        now + 30 * 86400000,
      )
      .run();
    return json(
      {
        id,
        url: new URL("/coach#invite=" + token, url.origin).href,
        coachName: personName(user),
        programName: snapshot.program.name,
        email,
        expires: now + 30 * 86400000,
      },
      201,
    );
  }
  const revoke = path.match(/^\/api\/coaching\/invitations\/([a-f0-9]{32})$/);
  if (revoke && method === "DELETE") {
    const r = await db
      .prepare(
        "UPDATE coach_invites SET revoked=? WHERE id=? AND coach_id=? AND accepted_by IS NULL AND revoked IS NULL",
      )
      .bind(Date.now(), revoke[1], user.id)
      .run();
    return r.meta.changes
      ? json({ ok: true })
      : json({ error: "Pending invitation not found." }, 404);
  }
  const detail = path.match(
    /^\/api\/coaching\/assignments\/([a-f0-9]{32})(?:\/workouts\/([^/]+))?$/,
  );
  if (detail) {
    const a = await assignment(db, detail[1]);
    if (!a || a.coach_id !== user.id || a.revoked)
      return json({ error: "Active client program not found." }, 404);
    if (method === "DELETE" && !detail[2]) {
      await db
        .prepare(
          "UPDATE coaching_assignments SET revoked=? WHERE id=? AND coach_id=? AND revoked IS NULL",
        )
        .bind(Date.now(), a.id, user.id)
        .run();
      return json({ ok: true });
    }
    const current = await journal(db, a.client_id),
      data = scoped(current.state, a.program_id);
    if (!data.program)
      return json(
        {
          error:
            "The client removed this program. Recorded history remains in their account.",
        },
        410,
      );
    if (method === "GET" && !detail[2])
      return json({
        id: a.id,
        clientName: a.client_name,
        clientEmail: a.client_email,
        coachName: a.coach_name,
        updated: a.updated,
        revision: current.revision,
        ...data,
      });
    if (method === "PATCH" && detail[2]) {
      const input = await body(request);
      if (
        !Number.isInteger(input.revision) ||
        input.revision !== current.revision
      )
        return json(
          {
            error:
              "The client updated their journal. Refresh their progress before saving so no results are overwritten.",
          },
          409,
        );
      let next;
      try {
        next = applyCoachLog(current.state, a.program_id, detail[2], input);
      } catch (e) {
        return json({ error: e.message }, 400);
      }
      const now = Date.now(),
        event = randomHex(16);
      const audit = db
        .prepare(
          "INSERT INTO coaching_log_events(id,assignment_id,coach_id,workout_id,created) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM journals WHERE user_id=? AND revision=?) AND EXISTS(SELECT 1 FROM coaching_assignments WHERE id=? AND coach_id=? AND client_id=? AND revoked IS NULL)",
        )
        .bind(
          event,
          a.id,
          user.id,
          detail[2],
          now,
          a.client_id,
          current.revision,
          a.id,
          user.id,
          a.client_id,
        );
      const write = db
        .prepare(
          "UPDATE journals SET data=?,revision=revision+1 WHERE user_id=? AND revision=? AND EXISTS(SELECT 1 FROM coaching_log_events WHERE id=?)",
        )
        .bind(JSON.stringify(next), a.client_id, current.revision, event);
      const updated = db
        .prepare(
          "UPDATE coaching_assignments SET updated=? WHERE id=? AND EXISTS(SELECT 1 FROM coaching_log_events WHERE id=?)",
        )
        .bind(now, a.id, event);
      const result = await db.batch([audit, write, updated]);
      if (!result[1].meta.changes)
        return json(
          {
            error:
              "The client changed their journal or ended access. Refresh before trying again.",
          },
          409,
        );
      journalCompleted(db, current.raw, next);
      return json({
        revision: current.revision + 1,
        updated: now,
        ...scoped(next, a.program_id),
      });
    }
  }
  return json({ error: "Coaching endpoint not found." }, 404);
}
