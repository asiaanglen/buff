import { identify } from "./session.js";
import { randomHex } from "./crypto.js";
import {
  snapshotProgram,
  copySharedProgram,
} from "../shared/program-sharing.js";
const json = (body, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function body(request) {
  const text = await request.text();
  if (text.length > 4096)
    throw Object.assign(Error("Request is too large."), { status: 413 });
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw Error("Invalid body");
    return parsed;
  } catch {
    throw Object.assign(Error("Invalid JSON."), { status: 400 });
  }
}
async function journal(db, userId) {
  const row = await db
    .prepare("SELECT data,revision FROM journals WHERE user_id=?")
    .bind(userId)
    .first();
  return {
    state: row ? JSON.parse(row.data) : null,
    revision: row?.revision || 0,
  };
}
function metadata(row) {
  const snapshot = JSON.parse(row.snapshot);
  return {
    inviterName: row.inviter_name,
    programName: snapshot.program.name,
    weeks: snapshot.program.weeks,
    workoutCount: snapshot.workouts.length,
  };
}
export async function sharingApi(request, env) {
  const url = new URL(request.url),
    path = url.pathname,
    db = env.DB;
  const match = path.match(
    /^\/api\/program-shares\/([a-f0-9]{64})(\/accept)?$/,
  );
  if (match && !match[2] && request.method === "GET") {
    const row = await db
      .prepare("SELECT inviter_name,snapshot FROM program_shares WHERE token=?")
      .bind(match[1])
      .first();
    return row
      ? json(metadata(row))
      : json(
          {
            error:
              "This invitation is no longer available. Ask your friend for a new link.",
          },
          404,
        );
  }
  const user = await identify(request, db);
  if (!user) return json({ error: "Sign in to share or add a program." }, 401);
  if (path === "/api/program-shares" && request.method === "GET") {
    const rows = await db
      .prepare(
        "SELECT token,inviter_name,created,snapshot FROM program_shares WHERE owner_id=? AND program_id=? ORDER BY created DESC LIMIT 20",
      )
      .bind(user.id, url.searchParams.get("program_id") || "")
      .all();
    return json({
      links: rows.results.map((row) => ({
        token: row.token,
        created: row.created,
        ...metadata(row),
      })),
    });
  }
  if (path === "/api/program-shares" && request.method === "POST") {
    const { programId, inviterName } = await body(request);
    if (
      typeof programId !== "string" ||
      programId.length > 100 ||
      typeof inviterName !== "string" ||
      !inviterName.trim() ||
      inviterName.trim().length > 80
    )
      return json(
        {
          error: "Choose a program and enter your name (up to 80 characters).",
        },
        400,
      );
    const { state } = await journal(db, user.id);
    let snapshot;
    try {
      snapshot = snapshotProgram(state, programId);
    } catch {
      return json({ error: "Program not found in your saved journal." }, 404);
    }
    const token = randomHex();
    await db
      .prepare(
        "INSERT INTO program_shares(token,owner_id,program_id,inviter_name,snapshot,created) VALUES(?,?,?,?,?,?)",
      )
      .bind(
        token,
        user.id,
        programId,
        inviterName.trim(),
        JSON.stringify(snapshot),
        Date.now(),
      )
      .run();
    return json(
      {
        token,
        url: new URL("/?invite=" + token, url.origin).href,
        inviterName: inviterName.trim(),
        programName: snapshot.program.name,
      },
      201,
    );
  }
  if (match && !match[2] && request.method === "DELETE") {
    const result = await db
      .prepare("DELETE FROM program_shares WHERE token=? AND owner_id=?")
      .bind(match[1], user.id)
      .run();
    return result.meta.changes
      ? json({ ok: true })
      : json({ error: "Invitation not found." }, 404);
  }
  if (match?.[2] && request.method === "POST") {
    const { startDate } = await body(request),
      token = match[1];
    for (let attempt = 0; attempt < 3; attempt++) {
      const imported = await db
        .prepare(
          "SELECT program_id FROM program_share_imports WHERE share_token=? AND user_id=?",
        )
        .bind(token, user.id)
        .first();
      if (imported)
        return json({ programId: imported.program_id, alreadyImported: true });
      const row = await db
        .prepare("SELECT * FROM program_shares WHERE token=?")
        .bind(token)
        .first();
      if (!row)
        return json(
          {
            error:
              "This invitation is no longer available. Ask your friend for a new link.",
          },
          404,
        );
      const current = await journal(db, user.id);
      if (
        row.owner_id === user.id &&
        current.state?.programs?.some(
          (program) => program.id === row.program_id,
        )
      )
        return json({ programId: row.program_id, alreadyImported: true });
      let copy;
      try {
        copy = copySharedProgram(
          current.state,
          JSON.parse(row.snapshot),
          startDate,
        );
      } catch (error) {
        return json({ error: error.message }, 400);
      }
      const nextRevision = current.revision + 1;
      const guard =
        "NOT EXISTS (SELECT 1 FROM program_share_imports WHERE share_token=? AND user_id=?) AND EXISTS (SELECT 1 FROM program_shares WHERE token=?)";
      const write =
        current.revision === 0
          ? db
              .prepare(
                `INSERT INTO journals(user_id,revision,data) SELECT ?,1,? WHERE ${guard} ON CONFLICT(user_id) DO NOTHING`,
              )
              .bind(user.id, JSON.stringify(copy.state), token, user.id, token)
          : db
              .prepare(
                `UPDATE journals SET data=?,revision=revision+1 WHERE user_id=? AND revision=? AND ${guard}`,
              )
              .bind(
                JSON.stringify(copy.state),
                user.id,
                current.revision,
                token,
                user.id,
                token,
              );
      const receipt = db
        .prepare(
          "INSERT INTO program_share_imports(share_token,user_id,program_id,created) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM journals WHERE user_id=? AND revision=? AND json_extract(data,?)=?) ON CONFLICT(share_token,user_id) DO NOTHING",
        )
        .bind(
          token,
          user.id,
          copy.programId,
          Date.now(),
          user.id,
          nextRevision,
          `$.programs[${copy.state.programs.length - 1}].id`,
          copy.programId,
        );
      await db.batch([write, receipt]);
      const result = await db
        .prepare(
          "SELECT program_id FROM program_share_imports WHERE share_token=? AND user_id=?",
        )
        .bind(token, user.id)
        .first();
      if (result) return json({ programId: result.program_id });
    }
    return json(
      {
        error:
          "Your journal changed while adding the program. Please try again.",
      },
      409,
    );
  }
  return json({ error: "Invitation endpoint not found." }, 404);
}
