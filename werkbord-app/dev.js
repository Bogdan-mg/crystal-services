// Lokaal testen: `APP_PIN=1234 npm run dev`, dan http://localhost:3000.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import handler from './api/taken.js';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const poort = Number(process.env.PORT) || 3000;
http.createServer(async (req, res) => {
  const pad = new URL(req.url, 'http://x').pathname;
  if (pad === '/api/taken') return handler(req, res);
  try {
    const bestand = pad.endsWith('/') ? pad + 'index.html' : pad;
    const inhoud = await readFile(new URL('./public' + bestand, import.meta.url));
    res.setHeader('Content-Type', TYPES[extname(bestand)] || 'application/octet-stream');
    res.end(inhoud);
  } catch { res.statusCode = 404; res.end('Niet gevonden'); }
}).listen(poort, () => console.log(`Werkbord op http://localhost:${poort}`));
