import helmet from 'helmet';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { raw } from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/globalexception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { API_PATHS } from './common/constants/api.paths';
import { SWAGGER_META } from './common/constants/swagger.meta';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix(API_PATHS.V1_PREFIX);
  // Stripe webhook needs raw body for signature verification
  app.use(
    `/${API_PATHS.V1_PREFIX}/subscription/webhook`,
    raw({ type: 'application/json' }),
  );
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));

  const config = new DocumentBuilder()
    .setTitle(SWAGGER_META.DOCS.TITLE)
    .setDescription(SWAGGER_META.DOCS.DESCRIPTION)
    .setVersion(SWAGGER_META.DOCS.VERSION)
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'firebaseauth',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(API_PATHS.DOCS, app, document);

  const port = Number(process.env.APP_PORT ?? 3000);
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Swagger docs available at: http://localhost:${port}/api/docs`);
}

void bootstrap();
