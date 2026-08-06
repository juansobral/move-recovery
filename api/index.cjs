// Única función serverless de Vercel: todo /api/* se reescribe acá (ver
// vercel.json). Arranca Nest una sola vez por contenedor "tibio" y reutiliza
// esa instancia (y su pool de conexiones) en cada invocación siguiente.
//
// Extensión .cjs a propósito: la raíz del repo tiene "type": "module" en
// package.json (lo necesita el build de Vite), así que un .js acá se trata
// como ES module y `module.exports`/`require` rompen en runtime — .cjs
// fuerza CommonJS sin importar el "type" del package.json.
let cachedHandlerPromise;

module.exports = async (req, res) => {
  if (!cachedHandlerPromise) {
    cachedHandlerPromise = require('../server/dist/bootstrap').bootstrap();
  }
  const handler = await cachedHandlerPromise;
  return handler(req, res);
};

// Nest necesita el body sin parsear para poder parsearlo una sola vez —
// si Vercel también lo consume, POST/DELETE quedan con body vacío.
module.exports.config = { api: { bodyParser: false } };
