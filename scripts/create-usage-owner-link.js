// Run only from the trusted deployment environment. No public endpoint can issue setup links.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomHex, digest } from "../worker/crypto.js";
const run = promisify(execFile);
async function sql(command) {
  const { stdout } = await run(
    process.execPath,
    [
      "scripts/wrangler.js",
      "d1",
      "execute",
      "buff",
      "--remote",
      "--json",
      "--command",
      command,
    ],
    { maxBuffer: 1024 * 1024 },
  );
  return JSON.parse(stdout);
}
const existing = await sql("SELECT COUNT(*) AS owners FROM usage_owners");
if (existing[0]?.results[0]?.owners) {
  console.log(
    "An owner is already configured. Sign into that Buff account and open Account → Usage dashboard.",
  );
} else {
  const token = randomHex(),
    hash = await digest(token),
    expires = Date.now() + 24 * 60 * 60 * 1000;
  await sql(
    `DELETE FROM usage_setup; INSERT INTO usage_setup(token_hash,expires) SELECT '${hash}',${expires} WHERE NOT EXISTS(SELECT 1 FROM usage_owners);`,
  );
  const origin =
    process.env.BUFF_PUBLIC_ORIGIN || "https://buff.asiaanglen.workers.dev";
  console.log(new URL("/usage/setup#setup=" + token, origin).href);
}
