import { identify } from "./session.js";
import { randomHex } from "./crypto.js";
export async function withAvatar(db, user) {
  if (!user) return null;
  try {
    const row = await db
      .prepare("SELECT version FROM profile_pictures WHERE user_id=?")
      .bind(user.id)
      .first();
    return { ...user, avatarVersion: row?.version || null };
  } catch {
    return user;
  }
}
export function validAvatar(bytes) {
  if (
    bytes.length < 20 ||
    bytes.length > 65536 ||
    bytes[0] !== 255 ||
    bytes[1] !== 216 ||
    bytes.at(-2) !== 255 ||
    bytes.at(-1) !== 217
  )
    return false;
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 255) return false;
    let marker = bytes[++offset];
    while (marker === 255) marker = bytes[++offset];
    offset++;
    if (marker === 218 || marker === 217) return false;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) return false;
    if ([192, 193, 194].includes(marker)) {
      if (length < 8) return false;
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4],
        width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      return width > 0 && width <= 512 && height > 0 && height <= 512;
    }
    offset += length;
  }
  return false;
}
export async function avatarApi(request, env) {
  const headers = {
    "Cache-Control": "no-store, private",
    "X-Content-Type-Options": "nosniff",
  };
  const json = (body, status = 200) => Response.json(body, { status, headers });
  const user = await identify(request, env.DB);
  if (!user)
    return json({ error: "Sign in to update your profile picture." }, 401);
  if (request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT image FROM profile_pictures WHERE user_id=?",
    )
      .bind(user.id)
      .first();
    if (!row) return new Response(null, { status: 404, headers });
    return new Response(new Uint8Array(row.image), {
      headers: {
        ...headers,
        "Content-Type": "image/jpeg",
        "Content-Disposition": "inline; filename=profile.jpg",
      },
    });
  }
  if (
    request.headers.get("Origin") !==
    (env.PUBLIC_ORIGIN || new URL(request.url).origin)
  )
    return json({ error: "Request origin is not allowed." }, 403);
  if (request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM profile_pictures WHERE user_id=?")
      .bind(user.id)
      .run();
    return json({ avatarVersion: null });
  }
  if (request.method !== "PUT")
    return json({ error: "Method not allowed." }, 405);
  if (request.headers.get("Content-Type") !== "image/jpeg")
    return json({ error: "Choose a photo using Edit profile." }, 400);
  const reader = request.body?.getReader();
  if (!reader) return json({ error: "Choose a picture first." }, 400);
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 65536) {
      await reader.cancel();
      return json(
        { error: "Picture must be under 64 KB after resizing." },
        413,
      );
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  if (!validAvatar(bytes))
    return json(
      {
        error: "Choose a valid profile picture, up to 512 pixels wide or tall.",
      },
      400,
    );
  const version = randomHex(16);
  await env.DB.prepare(
    "INSERT INTO profile_pictures(user_id,version,image,updated) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET version=excluded.version,image=excluded.image,updated=excluded.updated",
  )
    .bind(user.id, version, bytes.buffer, Date.now())
    .run();
  return json({ avatarVersion: version });
}
