import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  const corsOrigins = process.env.CORS_ORIGINS?.split(',').map((origin) =>
    origin.trim(),
  );
  if (!corsOrigins && process.env.NODE_ENV === 'production') {
    // Fail closed, never silently reflect any origin with credentials: true
    // in production — a missing env var should be a deploy-time error.
    throw new Error(
      'CORS_ORIGINS must be set in production (comma-separated list of allowed origins)',
    );
  }
  app.enableCors({ origin: corsOrigins ?? true, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(process.env.PORT ?? 4100);
}
bootstrap();
