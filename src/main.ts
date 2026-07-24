import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Set up production CORS configuration
  const frontendUrl = process.env.FRONTEND_URL;
  const allowedOrigins = frontendUrl
    ? frontendUrl.split(',').map((url) => url.trim())
    : ['http://localhost:3000', 'http://localhost:3002'];

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (like server-to-server or Postman)
      if (!origin) return callback(null, true);
      
      const isAllowed = allowedOrigins.some((allowedOrigin) => {
        return origin === allowedOrigin || allowedOrigin === '*';
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  app.setGlobalPrefix('api');

  // Protect headers with helmet (keep crossOriginResourcePolicy: false for static uploads)
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    }),
  );

  // Compress response payloads
  app.use(compression());

  // Global Exception filter to clean/sanitize internal errors from client responses
  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Ensure uploads folder exists and serve it statically
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir);
  }
  app.use('/uploads', express.static(uploadsDir));

  // Enable Graceful Shutdown hooks for hosting orchestrators
  app.enableShutdownHooks();

  const port = process.env.PORT || 3001;
  // Bind explicitly to 0.0.0.0 for containerized host systems
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://localhost:${port}/api`);
}
bootstrap();
