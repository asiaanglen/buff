import { test, expect } from "./auth-fixture.js";
test("new Google accounts must complete their profile and keep the birth date after reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  let completed = false;
  await page.route("**/api/auth/session", async (route) => {
    const response = await route.fetch();
    const result = await response.json();
    if (!completed && result.user) {
      result.user = {
        id: result.user.id,
        email: result.user.email,
        firstName: "Ana",
        lastName: "O’Neill",
        profileRequired: true,
      };
    }
    await route.fulfill({ response, json: result });
  });
  await page.route("**/api/auth/profile", async (route) => {
    const response = await route.fetch();
    if (response.ok()) completed = true;
    await route.fulfill({ response });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Complete your profile", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("First Name", { exact: true })).toHaveValue(
    "Ana",
  );
  await expect(page.getByLabel("Last Name", { exact: true })).toHaveValue(
    "O’Neill",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Date of Birth", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  expect(completed).toBe(false);
  await page.getByLabel("Date of Birth", { exact: true }).fill("1988-03-22");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your account", exact: true }),
  ).toBeVisible();
  const session = await (await page.request.get("/api/auth/session")).json();
  expect(session.user).toMatchObject({
    firstName: "Ana",
    lastName: "O’Neill",
    dateOfBirth: "1988-03-22",
  });
  expect(session.user.profileRequired).toBeUndefined();
  await page.reload();
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Complete your profile", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("Account edits and cancels profile changes, keeps workout history, and syncs details to another device", async ({
  page,
  baseURL,
  browser,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");
  await expect(page.locator("#sync-label")).toContainText("Synced");
  const before = await (await page.request.get("/api/state")).json();
  await page
    .getByRole("button", { name: "Account and cross-device sync", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await expect(page.getByLabel("First Name", { exact: true })).toHaveValue(
    "Test",
  );
  await page.getByLabel("First Name", { exact: true }).fill("Alex");
  await page.getByLabel("Last Name", { exact: true }).fill("Rivera");
  await page.getByLabel("Date of Birth", { exact: true }).fill("1994-04-25");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".account-message")).toContainText(
    "Profile updated.",
  );
  expect(await (await page.request.get("/api/state")).json()).toEqual(before);
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page
    .getByLabel("First Name", { exact: true })
    .fill("Discard this draft");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await expect(page.getByLabel("First Name", { exact: true })).toHaveValue(
    "Alex",
  );
  await page.getByLabel("Date of Birth", { exact: true }).fill("2999-01-01");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Edit profile", exact: true }),
  ).toBeVisible();
  expect(
    (await (await page.request.get("/api/auth/session")).json()).user
      .dateOfBirth,
  ).toBe("1994-04-25");
  await page.getByLabel("Date of Birth", { exact: true }).fill("1994-04-25");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator("#account-root .modal")
    .screenshot({ path: "/tmp/buff-edit-profile-mobile.png" });
  const other = await browser.newContext({
    storageState: { cookies: await page.context().cookies(), origins: [] },
  });
  const device = await other.newPage();
  await device.goto(baseURL);
  await device
    .getByRole("button", { name: "Account and cross-device sync", exact: true })
    .click();
  await device
    .getByRole("button", { name: "Edit profile", exact: true })
    .click();
  await expect(device.getByLabel("First Name", { exact: true })).toHaveValue(
    "Alex",
  );
  await expect(device.getByLabel("Last Name", { exact: true })).toHaveValue(
    "Rivera",
  );
  await expect(device.getByLabel("Date of Birth", { exact: true })).toHaveValue(
    "1994-04-25",
  );
  await other.close();
});

test("email and password edits reauthenticate, reject wrong passwords, preserve the account, and revoke other sessions", async ({
  page,
  baseURL,
  browser,
}) => {
  const { passwordProof, authScheme } =
    await import("../../src/credentials.js");
  await page.goto("/");
  const original = (await (await page.request.get("/api/auth/session")).json())
    .user;
  await expect(page.locator("#sync-label")).toContainText("Synced");
  const before = await (await page.request.get("/api/state")).json();
  const other = await browser.newContext({
    extraHTTPHeaders: {
      "CF-Connecting-IP": `198.18.254.${Math.floor(Math.random() * 200) + 1}`,
    },
  });
  const headers = { Origin: baseURL };
  const oldPassword = "a private fixture password";
  expect(
    (
      await other.request.post(baseURL + "/api/auth/signin", {
        headers,
        data: {
          email: original.email,
          password: await passwordProof(original.email, oldPassword),
          credentialVersion: authScheme,
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page
    .getByRole("button", { name: "Account and cross-device sync", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  const email = `updated-${crypto.randomUUID()}@example.com`;
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByText("Change password", { exact: true }).click();
  await page.getByLabel("New password", { exact: true }).fill("x");
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill("different");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".account-message")).toContainText(
    "New passwords do not match.",
  );
  await page.getByLabel("Confirm new password", { exact: true }).fill("x");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".account-message")).toContainText(
    "Enter your current password",
  );
  await page
    .getByLabel("Current password", { exact: true })
    .fill("wrong password");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".account-message")).toContainText(
    "Your current password is incorrect.",
  );
  expect(
    (await (await page.request.get("/api/auth/session")).json()).user.email,
  ).toBe(original.email);
  await page.getByLabel("Current password", { exact: true }).fill(oldPassword);
  let submitted;
  page.on("request", (request) => {
    if (
      request.url().endsWith("/api/auth/profile") &&
      request.method() === "POST"
    )
      submitted = request.postDataJSON();
  });
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".account-message")).toContainText(
    "Profile updated.",
  );
  const updated = (await (await page.request.get("/api/auth/session")).json())
    .user;
  expect(updated).toMatchObject({
    id: original.id,
    email,
    firstName: original.firstName,
    dateOfBirth: original.dateOfBirth,
  });
  expect(submitted.currentPassword).toBe(
    await passwordProof(original.email, oldPassword),
  );
  expect(submitted.newPassword).toBe(await passwordProof(email, "x"));
  expect(await (await page.request.get("/api/state")).json()).toEqual(before);
  expect(
    (await (await other.request.get(baseURL + "/api/auth/session")).json())
      .user,
  ).toBeNull();
  expect(
    (
      await other.request.post(baseURL + "/api/auth/signin", {
        headers,
        data: {
          email: original.email,
          password: await passwordProof(original.email, oldPassword),
          credentialVersion: authScheme,
        },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await other.request.post(baseURL + "/api/auth/signin", {
        headers,
        data: {
          email,
          password: await passwordProof(email, oldPassword),
          credentialVersion: authScheme,
        },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await other.request.post(baseURL + "/api/auth/signin", {
        headers,
        data: {
          email,
          password: await passwordProof(email, "x"),
          credentialVersion: authScheme,
        },
      })
    ).ok(),
  ).toBeTruthy();
  await other.close();
});

test("duplicate emails leave the whole profile unchanged and an email-only edit keeps the same password", async ({
  page,
  baseURL,
  browser,
}) => {
  const { passwordProof, authScheme } =
    await import("../../src/credentials.js");
  const { signupProfile } = await import("../signup-profile.js");
  await page.goto("/");
  const original = (await (await page.request.get("/api/auth/session")).json())
    .user;
  const other = await browser.newContext({
    extraHTTPHeaders: {
      "CF-Connecting-IP": `198.18.253.${Math.floor(Math.random() * 200) + 1}`,
    },
  });
  const email = `occupied-${crypto.randomUUID()}@example.com`,
    current = "a private fixture password";
  const headers = { Origin: baseURL };
  const signup = await other.request.post(baseURL + "/api/auth/signup", {
    headers,
    data: {
      ...signupProfile,
      email,
      password: await passwordProof(email, "another account password"),
      credentialVersion: authScheme,
    },
  });
  expect(signup.ok()).toBeTruthy();
  const occupied = (await signup.json()).user;
  const duplicate = await page.request.post("/api/auth/profile", {
    headers,
    data: {
      ...signupProfile,
      firstName: "Should not stick",
      email,
      currentPassword: await passwordProof(original.email, current),
      newPassword: await passwordProof(email, current),
      credentialVersion: authScheme,
      userId: occupied.id,
    },
  });
  expect(duplicate.status()).toBe(409);
  expect(
    (await (await page.request.get("/api/auth/session")).json()).user,
  ).toEqual(original);
  expect(
    (await (await other.request.get(baseURL + "/api/auth/session")).json())
      .user,
  ).toEqual(occupied);
  await page
    .getByRole("button", { name: "Account and cross-device sync", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  const nextEmail = `email-only-${crypto.randomUUID()}@example.com`;
  await page.getByLabel("Email", { exact: true }).fill(nextEmail);
  await page.getByLabel("Current password", { exact: true }).fill(current);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".account-message")).toContainText(
    "Profile updated.",
  );
  const signin = await other.request.post(baseURL + "/api/auth/signin", {
    headers,
    data: {
      email: nextEmail,
      password: await passwordProof(nextEmail, current),
      credentialVersion: authScheme,
    },
  });
  expect(signin.ok()).toBeTruthy();
  expect((await signin.json()).user.id).toBe(original.id);
  await other.close();
});

test("Google-only profile editing exposes profile fields and keeps sign-in details managed by Google", async ({
  page,
}) => {
  await page.route("**/api/auth/session", async (route) => {
    const response = await route.fetch();
    const result = await response.json();
    if (result.user) result.user.passwordEnabled = false;
    await route.fulfill({ response, json: result });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Account and cross-device sync", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute(
    "readonly",
    "",
  );
  await expect(
    page.getByLabel("Current password", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Your email and sign-in are managed through Google.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("First Name", { exact: true }).fill("Google profile");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".account-message")).toContainText(
    "Profile updated.",
  );
});
