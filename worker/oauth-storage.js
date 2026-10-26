// The OAuth library only needs the KV get/put/delete/list contract. D1 gives it
// indexed, strongly consistent storage without another Cloudflare binding.
export function oauthStorage(db) {
  return {
    async get(name, options = {}) {
      const row = await db
        .prepare(
          "SELECT value FROM oauth_storage WHERE name=? AND (expires IS NULL OR expires>?)",
        )
        .bind(name, Math.floor(Date.now() / 1000))
        .first();
      if (!row) return null;
      const type = typeof options === "string" ? options : options.type;
      if (type === "json") return JSON.parse(row.value);
      if (type === "arrayBuffer")
        return new TextEncoder().encode(row.value).buffer;
      if (type === "stream") return new Response(row.value).body;
      return row.value;
    },
    async put(name, value, options = {}) {
      if (typeof value !== "string")
        throw Error("OAuth records must be strings");
      const expires =
        options.expiration ??
        (options.expirationTtl
          ? Math.floor(Date.now() / 1000) + options.expirationTtl
          : null);
      await db
        .prepare(
          "INSERT INTO oauth_storage(name,value,metadata,expires) VALUES(?,?,?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value,metadata=excluded.metadata,expires=excluded.expires",
        )
        .bind(
          name,
          value,
          options.metadata ? JSON.stringify(options.metadata) : null,
          expires,
        )
        .run();
    },
    async delete(name) {
      await db
        .prepare("DELETE FROM oauth_storage WHERE name=?")
        .bind(name)
        .run();
    },
    async list({ prefix = "", limit = 1000, cursor } = {}) {
      limit = Math.min(1000, Math.max(1, limit));
      let after = "";
      if (cursor) after = decodeURIComponent(atob(cursor));
      const { results } = await db
        .prepare(
          "SELECT name,metadata,expires FROM oauth_storage WHERE name>=? AND name<? AND name>? AND (expires IS NULL OR expires>?) ORDER BY name LIMIT ?",
        )
        .bind(
          prefix,
          prefix + "\uffff",
          after,
          Math.floor(Date.now() / 1000),
          limit + 1,
        )
        .all();
      const more = results.length > limit,
        rows = results.slice(0, limit);
      return {
        keys: rows.map((r) => ({
          name: r.name,
          ...(r.metadata ? { metadata: JSON.parse(r.metadata) } : {}),
          ...(r.expires ? { expiration: r.expires } : {}),
        })),
        list_complete: !more,
        cursor: more ? btoa(encodeURIComponent(rows.at(-1).name)) : "",
      };
    },
  };
}
