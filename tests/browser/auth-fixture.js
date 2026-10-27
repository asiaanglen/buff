import { signupProfile } from "../signup-profile.js";
import { test as base, expect } from "@playwright/test";
import { passwordProof, authScheme } from "../../src/credentials.js";
export { expect };
// Exercise private app screens with real sessions. Distinct simulated client IPs
// keep unrelated test accounts from sharing the production sign-in rate bucket.
export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    await page.context().setExtraHTTPHeaders({
      "CF-Connecting-IP": `198.18.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`,
    });
    const email = `app-${crypto.randomUUID()}@example.com`,
      password = "a private fixture password";
    const meta = await (
      await page.request.get(baseURL + "/api/auth/session")
    ).json();
    const signup = await page.request.post(baseURL + "/api/auth/signup", {
      headers: { Origin: baseURL },
      data: {
        ...signupProfile,
        email,
        password:
          meta.authScheme === authScheme
            ? await passwordProof(email, password)
            : password,
        ...(meta.authScheme === authScheme
          ? { credentialVersion: authScheme }
          : {}),
      },
    });
    expect(signup.status()).toBe(200);
    const { user } = await signup.json();
    await page.addInitScript((id) => {
      window.readTestJournal = () => {
        const account = JSON.parse(localStorage.getItem("buff-account-" + id));
        return account?.state || JSON.parse(localStorage.getItem("buff-v1"));
      };
    }, user.id);
    await use(page);
  },
});
