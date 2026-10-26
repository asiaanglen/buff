export const authScheme = "pbkdf2-sha256-v1";
const encode = (s) => new TextEncoder().encode(s);
const hex = (bytes) =>
  [...new Uint8Array(bytes)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
export const randomHex = (bytes = 32) =>
  hex(crypto.getRandomValues(new Uint8Array(bytes)));
export async function digest(value) {
  return hex(await crypto.subtle.digest("SHA-256", encode(value)));
}
async function verifierKey(salt) {
  return crypto.subtle.importKey(
    "raw",
    encode(salt),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
export async function makeVerifier(proof, salt) {
  return hex(
    await crypto.subtle.sign("HMAC", await verifierKey(salt), encode(proof)),
  );
}
export async function checkVerifier(proof, salt, expected) {
  if (!/^[a-f0-9]{64}$/.test(expected)) return false;
  return crypto.subtle.verify(
    "HMAC",
    await verifierKey(salt),
    Uint8Array.from(expected.match(/../g), (v) => parseInt(v, 16)),
    encode(proof),
  );
}
