import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

const PORT = process.env.SPA_BACKEND_PORT ?? process.env.BACKEND_PORT ?? process.env.PORT ?? 4567;

function validateEnv(): void {
  const required = ['SPA_POSTGRES_URL', 'SPA_REDIS_URL', 'SPA_FRONTEND_URL'];
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

function getCorsOrigin(): string | string[] | ((origin: string, callback: (err: Error | null, allow?: boolean) => void) => void) {
  const raw = process.env.SPA_CORS_ORIGIN ?? process.env.SPA_FRONTEND_URL ?? process.env.CORS_ORIGIN ?? process.env.FRONTEND_URL ?? 'http://localhost:5678';
  const origins = raw.split(',').map((o) => o.trim()).filter(Boolean);
  return origins.length === 1 ? origins[0] : origins;
}

async function bootstrap() {
  validateEnv();
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const origin = getCorsOrigin();
  app.enableCors({ origin, credentials: true });
  await app.listen(PORT);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
