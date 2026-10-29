import { profilePictureEditor } from "./profile-picture.js";
export function profileFields(escape, user = {}) {
  const now = new Date();
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
  return `<div class="form-grid account-profile-fields"><label>First Name<input name="firstName" autocomplete="given-name" required maxlength="80" value="${escape(user.firstName || "")}"></label><label>Last Name<input name="lastName" autocomplete="family-name" required maxlength="80" value="${escape(user.lastName || "")}"></label><label class="profile-birth">Date of Birth<input name="dateOfBirth" type="date" autocomplete="bday" required max="${today}" value="${escape(user.dateOfBirth || "")}"></label></div>`;
}

export function profileEditor(escape, user, message = "") {
  const passwordEnabled = user.passwordEnabled !== false;
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="account-title"><div class="modal-header"><div><div class="eyebrow">YOUR ACCOUNT DETAILS</div><h2 id="account-title">Edit profile</h2></div><button type="button" class="icon-button close" data-cloud="close" aria-label="Close account">×</button></div><p class="account-message" role="status">${escape(message)}</p>${profilePictureEditor(escape, user)}<form id="edit-profile-form">${profileFields(escape, user)}<label>Email<input name="email" type="email" autocomplete="email" required maxlength="254" value="${escape(user.email)}" ${passwordEnabled ? "" : "readonly"}></label>${passwordEnabled ? `<label>Current password<input name="currentPassword" type="password" autocomplete="current-password" maxlength="200"></label><p class="field-help">Enter your current password only when changing your email or password. Changing either signs out your other devices.</p><details class="profile-security"><summary>Change password</summary><label>New password<input name="newPassword" type="password" autocomplete="new-password" maxlength="200"></label><label>Confirm new password<input name="confirmPassword" type="password" autocomplete="new-password" maxlength="200"></label></details>` : '<p class="field-help">Your email and sign-in are managed through Google.</p>'}<div class="modal-footer"><button type="button" class="button subtle" data-cloud="account">Cancel</button><button type="submit" class="button primary">Save changes</button></div></form></section></div>`;
}
