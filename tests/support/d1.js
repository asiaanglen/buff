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
          args = values.map((value) =>
            value instanceof ArrayBuffer ? new Uint8Array(value) : value,
          );
          return this;
        },
        async first() {
          return statement.get(...args) || null;
        },
        async run() {
          if (statement.columns().length)
            return { results: statement.all(...args), meta: { changes: 0 } };
          const r = statement.run(...args);
          return {
            meta: {
              changes: Number(r.changes),
              rows_written: Number(r.changes),
              rows_read: 0,
            },
          };
        },
        async all() {
          const results = statement.all(...args);
          return {
            results,
            meta: { rows_read: results.length, rows_written: 0 },
          };
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
