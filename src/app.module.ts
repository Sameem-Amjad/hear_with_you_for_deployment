import Joi from 'joi';
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ActivityModule } from './modules/activity/activity.module';
import { AuthModule } from './modules/auth/auth.module';
import { FirebaseModule } from './modules/firebase/firebase.module';
import { MailModule } from './modules/mail/mail.module';
import { OtpModule } from './modules/otp/otp.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { SmsModule } from './modules/sms/sms.module';
import { StorageModule } from './modules/storage/storage.module';
import { UserModule } from './modules/user/user.module';
import { ActivityLoggerInterceptor } from './common/interceptors/activitylogger.interceptor';
import { FirebaseAuthGuard } from './common/guards/firebaseauth.guard';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';
import { QueueModule } from './modules/queue/queue.module';
import { ProviderCredentialsModule } from './modules/provider-credentials/provider-credentials.module';
import { VoiceProfileModule } from './modules/voice-profile/voice-profile.module';
import { StoryModule } from './modules/story/story.module';
import { AudioModule } from './modules/audio/audio.module';
import { StoryGenerationModule } from './modules/story-generation/story-generation.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        FIREBASE_PROJECT_ID: Joi.string().required(),
        FIREBASE_CLIENT_EMAIL: Joi.string().email().required(),
        FIREBASE_PRIVATE_KEY: Joi.string().required(),
        DO_SPACES_KEY: Joi.string().required(),
        DO_SPACES_SECRET: Joi.string().required(),
        DO_SPACES_ENDPOINT: Joi.string().uri().required(),
        DO_SPACES_BUCKET: Joi.string().required(),
        DO_SPACES_REGION: Joi.string().required(),
        SMTP_HOST: Joi.string().required(),
        SMTP_PORT: Joi.number().required(),
        SMTP_USER: Joi.string().required(),
        SMTP_PASS: Joi.string().required(),
        EMAIL_FROM: Joi.string().required(),
        TWILIO_ACCOUNT_SID: Joi.string().required(),
        TWILIO_AUTH_TOKEN: Joi.string().required(),
        TWILIO_PHONE_NUMBER: Joi.string().required(),
        APP_ENCRYPTION_KEY: Joi.string().required(),
        STRIPE_WEBHOOK_SECRET: Joi.string().required(),
        STRIPE_SUCCESS_URL: Joi.string().uri().required(),
        STRIPE_CANCEL_URL: Joi.string().uri().required(),
        ADMIN_EMAILS: Joi.string().default(''),
        REDIS_HOST: Joi.string().default('127.0.0.1'),
        REDIS_PORT: Joi.number().default(6379),
        REDIS_PASSWORD: Joi.string().allow('').optional(),
        OTP_EXPIRY_MINUTES: Joi.number().default(5),
        JWT_SECRET: Joi.string().allow('').optional(),
        APP_PORT: Joi.number().default(3000),
        CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get('NODE_ENV') === 'development' ? 60 * 1000 : 15 * 60 * 1000,
          limit: config.get('NODE_ENV') === 'development' ? 1000 : 100,
        },
      ],
    }),
    PrismaModule,
    FirebaseModule,
    MailModule,
    SmsModule,
    StorageModule,
    OtpModule,
    ActivityModule,
    QueueModule,
    ProviderCredentialsModule,
    AuthModule,
    VoiceProfileModule,
    StoryModule,
    AudioModule,
    StoryGenerationModule,
    SubscriptionModule,
    AnalyticsModule,
    NotificationModule,
    AdminModule,
    UserModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: FirebaseAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ActivityLoggerInterceptor,
    },
  ],
})
export class AppModule {}
