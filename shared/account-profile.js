export function profileError(
  input,
  today = new Date().toISOString().slice(0, 10),
) {
  for (const [key, label] of [
    ["firstName", "First Name"],
    ["lastName", "Last Name"],
  ]) {
    if (
      typeof input?.[key] !== "string" ||
      !input[key].trim() ||
      input[key].trim().length > 80
    )
      return `${label} is required and must be at most 80 characters.`;
  }
  const date = input?.dateOfBirth;
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date ||
    date < "0001-01-01" ||
    date > today
  )
    return "Enter a valid Date of Birth that is not in the future.";
  return null;
}
export function accountUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    ...(typeof row.password === "string"
      ? { passwordEnabled: !row.password.startsWith("google-only:") }
      : {}),
    ...(row.first_name != null ? { firstName: row.first_name } : {}),
    ...(row.last_name != null ? { lastName: row.last_name } : {}),
    ...(row.date_of_birth != null ? { dateOfBirth: row.date_of_birth } : {}),
    ...(row.profile_required ? { profileRequired: true } : {}),
  };
}
