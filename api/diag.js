// api/diag.js — diagnóstico temporal. Devuelve SOLO nombres de env (sin valores).
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const keys = Object.keys(process.env);
  const tokenLike = keys.filter(k => /READ_WRITE_TOKEN$/.test(k));
  const found = tokenLike.find(k => String(process.env[k]).startsWith("vercel_blob_rw_"));
  res.status(200).json({
    ok: true,
    has_BLOB_READ_WRITE_TOKEN: !!process.env.BLOB_READ_WRITE_TOKEN,
    token_like_vars: tokenLike,                 // nombres que terminan en READ_WRITE_TOKEN
    resolved_var: found || null,                // el que arranca con vercel_blob_rw_
    has_MS_CLIENT_ID: !!process.env.MS_CLIENT_ID,
    has_MS_REFRESH_TOKEN: !!process.env.MS_REFRESH_TOKEN,
    has_ADMIN_PASS: !!process.env.ADMIN_PASS,
  });
}
