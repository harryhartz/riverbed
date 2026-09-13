// Thin wrapper around Cloudinary's unsigned upload API. Using the
// plain HTTP upload endpoint (not the cloudinary SDK) keeps this
// dependency-free and works identically in a Netlify Function.
//
// Requires an unsigned upload preset configured in your Cloudinary
// dashboard (Settings → Upload → Upload presets → add preset →
// Signing mode: Unsigned). This lets the browser upload directly to
// Cloudinary without exposing your API secret, and the function only
// needs the cloud name + preset name (both fine to expose).

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

export function cloudinaryConfigured() {
  return Boolean(CLOUD_NAME && UPLOAD_PRESET);
}

/**
 * Upload a base64 data URL to Cloudinary. Used server-side when the
 * client sends image data through our own function rather than
 * uploading directly (simpler for a v1 — trades a bit of function
 * execution time for not needing any client-side Cloudinary wiring).
 */
export async function uploadImage(dataUrl) {
  if (!cloudinaryConfigured()) {
    throw new Error(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET.'
    );
  }

  const form = new URLSearchParams();
  form.append('file', dataUrl);
  form.append('upload_preset', UPLOAD_PRESET);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cloudinary upload failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return {
    url: data.secure_url,
    public_id: data.public_id,
    width: data.width,
    height: data.height,
  };
}

/**
 * Delete an image from Cloudinary by public_id. Requires the signed
 * admin API (API_KEY + API_SECRET), unlike upload which can stay
 * unsigned. Only called from the soft-delete path's eventual hard
 * purge — normal entry deletion does NOT remove the Cloudinary asset,
 * consistent with the app's soft-delete-first philosophy.
 */
export async function deleteImage(publicId) {
  if (!API_KEY || !API_SECRET) {
    console.warn('Cloudinary API_KEY/API_SECRET not set — skipping remote delete.');
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`;

  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-1', encoder.encode(toSign));
  const signature = Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const form = new URLSearchParams();
  form.append('public_id', publicId);
  form.append('timestamp', String(timestamp));
  form.append('api_key', API_KEY);
  form.append('signature', signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Cloudinary delete failed (${res.status}): ${body}`);
  }
}
