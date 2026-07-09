// api/upload-image.js — Vercel Function
// Sube UNA imagen (base64) al Blob y devuelve su URL pública.
// Así las fotos no viajan dentro del JSON de admin-data (que revienta el límite de 4.5MB).

import { put } from '@vercel/blob';

const ADMIN_PASS = process.env.ADMIN_PASS || 'pino2026';

function blobToken() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  for (const k of Object.keys(process.env)) {
    const v = process.env[k];
    if (/READ_WRITE_TOKEN$/.test(k) && typeof v === 'string' && v.startsWith('vercel_blob_rw_')) return v;
  }
  return undefined;
}
const RW = blobToken();

// Permitir body grande (una sola imagen puede pesar ~1-2MB en base64)
export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Pass');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Método no permitido' }); return; }

  try {
    const pass = decodeURIComponent(req.headers['x-admin-pass'] || '');
    if (pass !== ADMIN_PASS) {
      res.status(401).json({ ok: false, error: 'Contraseña incorrecta' });
      return;
    }

    const { dataUrl } = req.body || {};
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      res.status(400).json({ ok: false, error: 'dataUrl inválido' });
      return;
    }

    // Extraer el base64 y convertir a Buffer
    const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match) {
      res.status(400).json({ ok: false, error: 'Formato de imagen no reconocido' });
      return;
    }
    const contentType = match[1];
    const buffer = Buffer.from(match[2], 'base64');

    // Nombre único
    const ext = contentType.split('/')[1].replace('+xml', '');
    const filename = 'productos/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;

    const blob = await put(filename, buffer, {
      access: 'public',
      contentType,
      addRandomSuffix: false,
      token: RW,
    });

    res.status(200).json({ ok: true, url: blob.url });
  } catch (e) {
    console.error('upload-image error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
}
