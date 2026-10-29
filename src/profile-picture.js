export const avatarUrl = (version) =>
  /^[a-f0-9]{32}$/.test(version || "") ? "/api/auth/avatar?v=" + version : "";
export function profilePictureEditor(escape, user) {
  const url = avatarUrl(user.avatarVersion);
  const initial = Array.from(
    user.firstName || user.lastName || "?",
  )[0].toLocaleUpperCase();
  return `<section class="profile-picture-editor"><h3>Profile picture</h3><div class="profile-picture-row"><span class="avatar profile-picture-preview">${url ? `<img src="${url}" alt="Your profile picture">` : escape(initial)}</span><div><label for="profile-picture-file">Choose a profile picture</label><input id="profile-picture-file" type="file" accept="image/*" data-avatar-input>${url ? '<button type="button" class="text-button danger" data-cloud="remove-avatar">Remove picture</button>' : ""}</div></div><p class="field-help">Choose a photo from your device. Pictures save automatically and appear on all your devices.</p></section>`;
}
export async function prepareProfilePicture(file) {
  if (!file || !file.type.startsWith("image/"))
    throw Error("Choose an image file.");
  if (file.size > 20 * 1024 * 1024)
    throw Error("Choose a picture smaller than 20 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw Error(
        "This image could not be opened. Try a JPEG, PNG, or WebP photo.",
      );
    }
    if (!image.naturalWidth || !image.naturalHeight)
      throw Error("Choose a valid image.");
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, 256, 256);
    const size = Math.min(image.naturalWidth, image.naturalHeight);
    context.drawImage(
      image,
      (image.naturalWidth - size) / 2,
      (image.naturalHeight - size) / 2,
      size,
      size,
      0,
      0,
      256,
      256,
    );
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!blob || blob.size > 65536)
      throw Error("This picture could not be resized. Try another photo.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
