// Stretch passwords in Web Crypto on the client to fit the Workers Free CPU budget.
// This proof is a password-equivalent credential: only transmit over HTTPS.
export const authScheme = "pbkdf2-sha256-v1";
export async function passwordProof(email, password) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: 600000,
      salt: encoder.encode(`buff:password:v1:${email.trim().toLowerCase()}`),
    },
    key,
    256,
  );
  return [...new Uint8Array(bits)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
