// Solo para desarrollo local (`npm run start:dev`). En Vercel, api/index.js
// llama a bootstrap() directamente y nunca pasa por acá.
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function main() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);
  console.log(`[server] escuchando en http://localhost:${port}/api`);
}

main();
