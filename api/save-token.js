// api/save-token.js
// Guarda un refresh token manualmente en Vercel Blob
// Llamado desde gettoken.html cuando el usuario pega el token a mano

import { put } from '@vercel/blob';

const TOKEN_BLOB = 'tiendapino-ms-token.json';

function blobToken() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  for (const k of Object.keys(process.env)) {
    const v = process.env[k];
    if (/READ_WRITE_TOKEN$/.test(k) && typeof v === 'string' && v.startsWith('vercel_blob_rw_')) return v;
  }
  return undefined;
}
const RW = blobToken();

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  }

  try {
    const { refresh_token } = req.body;

    if (!refresh_token || typeof refresh_token !== "string" || refresh_token.trim().length < 20) {
      return res.status(400).json({ ok: false, error: "Token inválido o vacío" });
    }

    await put(
      TOKEN_BLOB,
      JSON.stringify({
        refresh_token: refresh_token.trim(),
        updated: new Date().toISOString(),
        source: "manual",
      }),
      {
        access: 'public',
        contentType: 'application/json',
        allowOverwrite: true,
        addRandomSuffix: false,
        token: RW,
      }
    );

    return res.status(200).json({ ok: true, updated: new Date().toISOString() });

  } catch (e) {
    console.error("save-token error:", e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
