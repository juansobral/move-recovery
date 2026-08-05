// Arranca Nest sobre una instancia de Express propia y devuelve esa app,
// que se puede invocar directamente como (req, res) — sin adaptador tipo
// Lambda: Vercel Node Functions ya entregan un (req, res) real, así que
// serverless-http/@codegenie/serverless-express serían una capa de más.
import 'reflect-metadata';
import express, { Express } from 'express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

export async function bootstrap(): Promise<Express> {
  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
  configureApp(app);
  await app.init();
  return expressApp;
}
