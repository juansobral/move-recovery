// Única función serverless de Vercel: todo /api/* se reescribe acá (ver
// vercel.json). Arranca Nest una sola vez por contenedor "tibio" y reutiliza
// esa instancia (y su pool de conexiones) en cada invocación siguiente.
//
// ESM a propósito: la raíz del repo tiene "type": "module" en package.json
// (lo necesita el build de Vite) — Vercel solo reconoce .js/.ts/.mjs como
// función serverless (.cjs no está soportado), así que este archivo tiene
// que ser un ES module de verdad, no CommonJS con extensión .js.
import { bootstrap } from '../server/dist/bootstrap.js';

let cachedHandlerPromise;

export default async function handler(req, res) {
  if (!cachedHandlerPromise) {
    cachedHandlerPromise = bootstrap();
  }
  const handler = await cachedHandlerPromise;
  return handler(req, res);
}

// Nest necesita el body sin parsear para poder parsearlo una sola vez —
// si Vercel también lo consume, POST/DELETE quedan con body vacío.
export const config = { api: { bodyParser: false } };
