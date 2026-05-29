import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

/**
 * Bootstrap the NestJS application
 * Restart to load updated .env configuration
 */
export async function bootstrap(_serverless = false) {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  // Global prefix for all routes
  const apiPrefix = process.env.API_PREFIX || 'api/v1';
  app.setGlobalPrefix(apiPrefix, {
    exclude: [
      // Exclude health check endpoint from global prefix
      'health',
    ],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // Automatically transform payloads to DTO instances
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if extra properties are sent
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Configure CORS using CORS_ORIGIN env var (supports comma-separated values and '*' wildcards)
  const rawCors = process.env.CORS_ORIGIN;

  const parseOrigins = (raw?: string) => {
    // Default to strict production origins matching your exact domains
    if (!raw) {
      return [
        'https://global-radio-podcast.vercel.app',
        'https://global-radios-podcasts-platform-one.vercel.app',
        'https://global-radios-podcasts-platform.vercel.app'
      ];
    }

    const escape = (str: string) => str.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

    return raw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => {
        if (s.includes('*')) {
          const pattern = s.split('*').map(escape).join('.*');
          return new RegExp(`^${pattern}$`);
        }
        return s;
      });
  };

  const corsOrigins = parseOrigins(rawCors);

  // Robust, standard-compliant CORS configuration
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  const originLog = corsOrigins.map(o => (o instanceof RegExp ? o.toString() : o)).join(', ');
  console.log(`✅ CORS configured for origins: [${originLog}]`);

  // Start server
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log('');
  console.log('🚀 Global Radio & Podcast Platform API');
  console.log(`📡 Server running on: http://localhost:${port}`);
  console.log(`🔗 API endpoint: http://localhost:${port}/${apiPrefix}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('');
}

void bootstrap();
