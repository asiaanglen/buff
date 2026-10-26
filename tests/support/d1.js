import { DatabaseSync } from "node:sqlite";
export function testD1() {
  const raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys=ON");
  return {
    raw,
    prepare(sql) {
      const statement = raw.prepare(sql);
      let args = [];
      return {
        bind(...values) {
          args = values;
          return this;
        },
        async first() {
          return statement.get(...args) || null;
        },
        async run() {
          const r = statement.run(...args);
          return { meta: { changes: Number(r.changes) } };
        },
        async all() {
          return { results: statement.all(...args) };
        },
      };
    },
    async batch(statements) {
      raw.exec("BEGIN");
      try {
        const results = [];
        for (const s of statements) results.push(await s.run());
        raw.exec("COMMIT");
        return results;
      } catch (e) {
        raw.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
