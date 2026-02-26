import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const PORT = process.env.BACKEND_PORT ?? process.env.PORT ?? 4567;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const origin = process.env.CORS_ORIGIN ?? process.env.FRONTEND_URL ?? 'http://localhost:5678';
  app.enableCors({ origin, credentials: true });
  await app.listen(PORT);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
