import test from "node:test";
import assert from "node:assert/strict";
import { profileError, accountUser } from "../shared/account-profile.js";
test("account profiles require names and a real birth date without inventing an age restriction", () => {
  const profile = {
    firstName: "  Ana-María  ",
    lastName: "O’Neill",
    dateOfBirth: "2000-02-29",
  };
  assert.equal(profileError(profile, "2026-10-26"), null);
  assert.equal(
    profileError({ ...profile, dateOfBirth: "2026-10-26" }, "2026-10-26"),
    null,
  );
  for (const dateOfBirth of [
    "2026-10-27",
    "2001-02-29",
    "2000-02-30",
    "1990-13-01",
    "0000-01-01",
    "",
    null,
    1990,
  ])
    assert.ok(profileError({ ...profile, dateOfBirth }, "2026-10-26"));
  for (const firstName of [" ", "a".repeat(81), false, null])
    assert.ok(profileError({ ...profile, firstName }));
  assert.ok(profileError({ ...profile, lastName: " " }));
  assert.ok(profileError(null));
  assert.deepEqual(
    accountUser({
      id: "legacy",
      email: "old@example.com",
      password: "PRIVATE",
      salt: "PRIVATE",
    }),
    { id: "legacy", email: "old@example.com" },
  );
  assert.deepEqual(
    accountUser({
      id: "new",
      email: "new@example.com",
      first_name: "Ana",
      last_name: "O’Neill",
      date_of_birth: "2000-02-29",
      profile_required: 0,
      password: "PRIVATE",
    }),
    {
      id: "new",
      email: "new@example.com",
      firstName: "Ana",
      lastName: "O’Neill",
      dateOfBirth: "2000-02-29",
    },
  );
});
