export function profileFields(escape, user = {}) {
  const now = new Date();
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
  return `<div class="form-grid account-profile-fields"><label>First Name<input name="firstName" autocomplete="given-name" required maxlength="80" value="${escape(user.firstName || "")}"></label><label>Last Name<input name="lastName" autocomplete="family-name" required maxlength="80" value="${escape(user.lastName || "")}"></label><label class="profile-birth">Date of Birth<input name="dateOfBirth" type="date" autocomplete="bday" required max="${today}" value="${escape(user.dateOfBirth || "")}"></label></div>`;
}
