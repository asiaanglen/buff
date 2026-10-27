export const signupProfile = {
  firstName: "Test",
  lastName: "User",
  dateOfBirth: "1990-01-15",
};
export async function fillSignupProfile(page) {
  await page
    .getByLabel("First Name", { exact: true })
    .fill(signupProfile.firstName);
  await page
    .getByLabel("Last Name", { exact: true })
    .fill(signupProfile.lastName);
  await page
    .getByLabel("Date of Birth", { exact: true })
    .fill(signupProfile.dateOfBirth);
}
