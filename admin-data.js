// api/admin-data.js — Vercel Function
// GET: lee las ediciones del admin desde Vercel Blob
// POST: guarda las ediciones del admin en Vercel Blob (requiere ADMIN_PASS)

import { put, list } from '@vercel/blob';

const BLOB_FILENAME = 'tiendapino-admin-data.json';
const ADMIN_PASS = process.env.ADMIN_PASS || 'pino2026';

// Resuelve el token de Blob bajo CUALQUIER nombre de env terminado en
// READ_WRITE_TOKEN (Vercel a veces lo nombra <store>_READ_WRITE_TOKEN).
function blobToken() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  for (const k of Object.keys(process.env)) {
    const v = process.env[k];
    if (/READ_WRITE_TOKEN$/.test(k) && typeof v === 'string' && v.startsWith('vercel_blob_rw_')) return v;
  }
  return undefined;
}
const RW = blobToken();

// Permitir bodies grandes (por si todavía arrastra imágenes base64 viejas durante la migración)
export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Pass');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    if (req.method === 'GET') {
      const { blobs } = await list({ prefix: BLOB_FILENAME, token: RW });
      const blob = blobs.find(b => b.pathname === BLOB_FILENAME);
      if (!blob) {
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json({ ok: true, data: {} });
        return;
      }
      const r = await fetch(blob.downloadUrl || blob.url);
      if (!r.ok) {
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json({ ok: true, data: {} });
        return;
      }
      const data = await r.json();
      // Cache en edge/CDN: los ~4MB de fotos salen del CDN, no del Blob en cada visita.
      // Las ediciones del admin aparecen tras ~60s (stale-while-revalidate sirve al instante).
      // s-maxage=1 + SWR: las ediciones del panel se ven casi al instante
      // (sirve la copia y revalida en background; sin esperar al Blob).
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=1, stale-while-revalidate=600');
      res.status(200).json({ ok: true, data });
      return;
    }

    if (req.method === 'POST') {
      const parsed = req.body || {};
      // Compatibilidad: acepta pass en body (nuevo) o en header (viejo)
      const pass = parsed.pass !== undefined
        ? parsed.pass
        : decodeURIComponent(req.headers['x-admin-pass'] || '');
      if (pass !== ADMIN_PASS) {
        res.status(401).json({ ok: false, error: 'Contraseña incorrecta' });
        return;
      }
      // Solo verificar la contraseña (login), sin guardar nada
      if (parsed.verifyOnly === true) {
        res.status(200).json({ ok: true, verified: true });
        return;
      }
      // El contenido a guardar: body.data (nuevo) o el body entero sin pass (viejo)
      const body = parsed.data !== undefined ? parsed.data : parsed;
      if (typeof body !== 'object' || body === null) {
        res.status(400).json({ ok: false, error: 'Body inválido' });
        return;
      }
      await put(BLOB_FILENAME, JSON.stringify(body), {
        access: 'public',
        contentType: 'application/json',
        allowOverwrite: true,
        addRandomSuffix: false,
        token: RW,
      });
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ ok: false, error: 'Método no permitido' });
  } catch (e) {
    console.error('Error admin-data:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
}
