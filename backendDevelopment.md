# Complete Prisma Schema for HearWithYou

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// AUTHENTICATION & USER MANAGEMENT
// ============================================

model User {
  id                String            @id @default(uuid())
  firebaseUid       String?           @unique
  username          String?           @unique
  name              String?
  email             String?           @unique
  phone             String?           @unique
  passwordHash      String?
  profilePicture    String?
  provider          AuthProvider      @default(EMAIL)
  isActive          Boolean           @default(true)
  isDeleted         Boolean           @default(false)
  isProfileComplete Boolean           @default(false)
  lastActiveAt      DateTime?
  
  // Subscription Management
  subscriptionTier       SubscriptionTier @default(FREE)
  subscriptionStatus     SubscriptionStatus @default(INACTIVE)
  subscriptionId         String?           @unique // Stripe subscription ID
  customerId             String?           @unique // Stripe customer ID
  subscriptionStartDate  DateTime?
  subscriptionEndDate    DateTime?
  trialEndsAt            DateTime?
  cancelAtPeriodEnd      Boolean           @default(false)
  
  // Usage Tracking
  storiesGeneratedThisMonth Int     @default(0)
  voiceProfilesCount        Int     @default(0)
  totalStoriesGenerated     Int     @default(0)
  monthlyResetDate          DateTime?
  
  // Credits (for pay-per-use features)
  credits                   Int     @default(0)
  
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  
  // Relations
  activityHistory       ActivityHistory[]
  otpRecords            OtpRecord[]
  childProfiles         ChildProfile[]
  voiceProfiles         VoiceProfile[]
  stories               Story[]
  favorites             Favorite[]
  subscriptionHistory   SubscriptionHistory[]
  payments              Payment[]
  usageHistory          UsageHistory[]
  notifications         Notification[]

  @@index([email])
  @@index([phone])
  @@index([firebaseUid])
  @@index([subscriptionTier])
  @@map("users")
}

model ActivityHistory {
  id          String   @id @default(uuid())
  userId      String
  action      String
  description String?
  ipAddress   String?
  userAgent   String?
  metadata    Json?
  createdAt   DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([createdAt])
  @@map("activity_history")
}

model OtpRecord {
  id         String     @id @default(uuid())
  userId     String?
  identifier String
  otp        String
  type       OtpType
  purpose    OtpPurpose
  isUsed     Boolean    @default(false)
  expiresAt  DateTime
  attempts   Int        @default(0)
  createdAt  DateTime   @default(now())

  user User? @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([identifier, type, purpose])
  @@index([expiresAt])
  @@map("otp_records")
}

// ============================================
// CHILD PROFILES
// ============================================

model ChildProfile {
  id          String   @id @default(uuid())
  userId      String
  name        String
  nickname    String?
  age         Int
  dateOfBirth DateTime?
  gender      Gender?
  avatar      String?
  
  // Personalization
  interests         String[]  // Array of interests (animals, space, dinosaurs, etc.)
  favoriteColors    String[]
  favoriteCharacters String[]
  readingLevel      ReadingLevel?
  
  // Preferences
  preferredThemes   StoryTheme[]
  preferredDuration StoryDuration  @default(MEDIUM)
  bedtime           String?        // e.g., "20:00"
  
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  stories Story[]

  @@index([userId])
  @@index([age])
  @@map("child_profiles")
}

// ============================================
// VOICE PROFILES (ElevenLabs Voice Cloning)
// ============================================

model VoiceProfile {
  id              String   @id @default(uuid())
  userId          String
  name            String
  description     String?
  type            VoiceType @default(CUSTOM) // CUSTOM, PRESET
  
  // ElevenLabs Integration
  elevenLabsVoiceId String?  @unique
  elevenLabsModelId String?  @default("eleven_multilingual_v2")
  
  // Voice Samples
  sampleAudioUrls   String[]  // S3 URLs of uploaded samples
  sampleDuration    Int?      // Total duration in seconds
  
  // Voice Settings (ElevenLabs parameters)
  stability         Float   @default(0.5)     // 0-1
  similarityBoost   Float   @default(0.75)    // 0-1
  style             Float   @default(0.0)     // 0-1
  useSpeakerBoost   Boolean @default(true)
  
  // Voice Characteristics (for UI display)
  gender            VoiceGender?
  ageRange          VoiceAgeRange?
  accent            String?
  tone              String[]  // warm, energetic, calm, etc.
  
  // Status
  status          VoiceStatus @default(PROCESSING)
  processingError String?     @db.Text
  
  // Usage tracking
  timesUsed       Int     @default(0)
  lastUsedAt      DateTime?
  
  isActive        Boolean @default(true)
  isDefault       Boolean @default(false) // User's default voice
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  stories Story[]

  @@index([userId])
  @@index([status])
  @@index([elevenLabsVoiceId])
  @@map("voice_profiles")
}

// ============================================
// STORIES
// ============================================

model Story {
  id              String   @id @default(uuid())
  userId          String
  childProfileId  String?
  voiceProfileId  String?
  
  // Story Content
  title           String
  content         String   @db.Text
  summary         String?  @db.Text
  moralLesson     String?
  
  // Metadata
  theme           StoryTheme
  ageGroup        AgeGroup
  duration        StoryDuration @default(MEDIUM)
  language        String        @default("en")
  wordCount       Int?
  estimatedReadTime Int?        // In seconds
  
  // AI Generation Data
  promptUsed      String   @db.Text
  openaiModel     String   @default("gpt-4")
  openaiTokensUsed Int?
  temperature     Float    @default(0.8)
  
  // Personalization
  characterNames  String[]  // Names used in story
  customElements  Json?     // Custom story elements
  
  // Audio Data
  audioUrl        String?
  audioS3Key      String?
  audioDuration   Int?      // Actual audio duration in seconds
  audioSize       Int?      // File size in bytes
  audioFormat     String?   @default("mp3")
  audioStatus     AudioStatus @default(PENDING)
  audioError      String?   @db.Text
  
  // ElevenLabs TTS Data
  elevenLabsRequestId String?
  elevenLabsCharactersUsed Int?
  
  // Engagement
  playCount       Int      @default(0)
  completionCount Int      @default(0) // Times played to end
  averageRating   Float?
  
  // Flags
  isPublic        Boolean  @default(false)
  isFeatured      Boolean  @default(false)
  isReported      Boolean  @default(false)
  reportReason    String?
  
  // Publishing
  publishedAt     DateTime?
  lastPlayedAt    DateTime?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  childProfile  ChildProfile?  @relation(fields: [childProfileId], references: [id], onDelete: SetNull)
  voiceProfile  VoiceProfile?  @relation(fields: [voiceProfileId], references: [id], onDelete: SetNull)
  favorites     Favorite[]
  ratings       StoryRating[]
  playHistory   PlayHistory[]

  @@index([userId])
  @@index([theme])
  @@index([ageGroup])
  @@index([audioStatus])
  @@index([createdAt])
  @@index([isPublic, isFeatured])
  @@map("stories")
}

// ============================================
// FAVORITES & RATINGS
// ============================================

model Favorite {
  id        String   @id @default(uuid())
  userId    String
  storyId   String
  createdAt DateTime @default(now())

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  story Story @relation(fields: [storyId], references: [id], onDelete: Cascade)

  @@unique([userId, storyId])
  @@index([userId])
  @@index([storyId])
  @@map("favorites")
}

model StoryRating {
  id        String   @id @default(uuid())
  storyId   String
  userId    String
  rating    Int      // 1-5
  review    String?  @db.Text
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  story Story @relation(fields: [storyId], references: [id], onDelete: Cascade)

  @@unique([storyId, userId])
  @@index([storyId])
  @@map("story_ratings")
}

// ============================================
// PLAY HISTORY & ANALYTICS
// ============================================

model PlayHistory {
  id              String   @id @default(uuid())
  storyId         String
  userId          String
  childProfileId  String?
  
  // Playback data
  duration        Int?     // How long they listened (seconds)
  completionRate  Float?   // 0-100%
  wasCompleted    Boolean  @default(false)
  
  // Context
  deviceType      String?  // mobile, web, tablet
  platform        String?  // ios, android, web
  
  playedAt        DateTime @default(now())

  story Story @relation(fields: [storyId], references: [id], onDelete: Cascade)

  @@index([storyId])
  @@index([userId])
  @@index([playedAt])
  @@map("play_history")
}

// ============================================
// SUBSCRIPTIONS & PAYMENTS
// ============================================

model SubscriptionHistory {
  id                String             @id @default(uuid())
  userId            String
  tier              SubscriptionTier
  status            SubscriptionStatus
  
  // Stripe data
  stripeSubscriptionId String?
  stripePriceId        String?
  stripeInvoiceId      String?
  
  // Dates
  startDate         DateTime
  endDate           DateTime?
  canceledAt        DateTime?
  
  // Pricing
  amount            Float
  currency          String   @default("usd")
  interval          String   // month, year
  
  metadata          Json?
  createdAt         DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([stripeSubscriptionId])
  @@map("subscription_history")
}

model Payment {
  id                  String        @id @default(uuid())
  userId              String
  
  // Stripe data
  stripePaymentIntentId String?   @unique
  stripeChargeId        String?
  stripeInvoiceId       String?
  
  // Payment details
  amount              Float
  currency            String      @default("usd")
  status              PaymentStatus
  paymentMethod       PaymentMethod
  
  // Description
  description         String?
  metadata            Json?
  
  // Timestamps
  paidAt              DateTime?
  refundedAt          DateTime?
  createdAt           DateTime    @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([status])
  @@index([stripePaymentIntentId])
  @@map("payments")
}

// ============================================
// USAGE TRACKING
// ============================================

model UsageHistory {
  id              String      @id @default(uuid())
  userId          String
  resourceType    ResourceType
  resourceId      String?
  action          UsageAction
  
  // Consumption
  creditsUsed     Int?
  tokensUsed      Int?
  charactersUsed  Int?
  storageUsed     Int?        // Bytes
  
  // Metadata
  metadata        Json?
  timestamp       DateTime    @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([resourceType])
  @@index([timestamp])
  @@map("usage_history")
}

// ============================================
// QUEUE JOBS (Background Processing)
// ============================================

model QueueJob {
  id          String    @id @default(uuid())
  jobId       String?   @unique // Bull job ID
  queue       String    // Queue name
  type        JobType
  status      JobStatus @default(PENDING)
  priority    Int       @default(0)
  
  // Job Data
  payload     Json
  result      Json?
  error       String?   @db.Text
  
  // Retry logic
  attempts    Int       @default(0)
  maxAttempts Int       @default(3)
  
  // Relations
  userId      String?
  storyId     String?
  
  // Timestamps
  scheduledAt DateTime?
  startedAt   DateTime?
  completedAt DateTime?
  failedAt    DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([type, status])
  @@index([userId])
  @@index([storyId])
  @@index([queue])
  @@map("queue_jobs")
}

// ============================================
// NOTIFICATIONS
// ============================================

model Notification {
  id          String             @id @default(uuid())
  userId      String
  type        NotificationType
  title       String
  message     String             @db.Text
  
  // Action
  actionUrl   String?
  actionText  String?
  
  // Data
  data        Json?
  
  // Status
  isRead      Boolean            @default(false)
  readAt      DateTime?
  
  createdAt   DateTime           @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isRead])
  @@index([createdAt])
  @@map("notifications")
}

// ============================================
// TEMPLATES (Pre-made Story Templates)
// ============================================

model StoryTemplate {
  id              String       @id @default(uuid())
  name            String
  description     String?      @db.Text
  theme           StoryTheme
  ageGroup        AgeGroup
  
  // Template content
  promptTemplate  String       @db.Text
  placeholders    String[]     // Variables like {childName}, {interest}
  
  // Metadata
  isActive        Boolean      @default(true)
  isFeatured      Boolean      @default(false)
  usageCount      Int          @default(0)
  
  thumbnailUrl    String?
  tags            String[]
  
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@index([theme])
  @@index([ageGroup])
  @@index([isActive, isFeatured])
  @@map("story_templates")
}

// ============================================
// SETTINGS
// ============================================

model UserSettings {
  id                      String   @id @default(uuid())
  userId                  String   @unique
  
  // Notifications
  emailNotifications      Boolean  @default(true)
  pushNotifications       Boolean  @default(true)
  storyReadyNotification  Boolean  @default(true)
  weeklyDigest            Boolean  @default(true)
  
  // Privacy
  profileVisibility       String   @default("private")
  allowDataCollection     Boolean  @default(true)
  
  // Preferences
  defaultLanguage         String   @default("en")
  defaultAgeGroup         AgeGroup?
  defaultTheme            StoryTheme?
  autoPlayNext            Boolean  @default(false)
  downloadQuality         String   @default("high")
  
  // Parental Controls
  contentFilter           String   @default("strict")
  maxDailyStories         Int?
  
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  @@map("user_settings")
}

// ============================================
// FEEDBACK & SUPPORT
// ============================================

model Feedback {
  id          String       @id @default(uuid())
  userId      String?
  type        FeedbackType
  subject     String
  message     String       @db.Text
  rating      Int?         // 1-5
  
  // Context
  page        String?
  userAgent   String?
  metadata    Json?
  
  // Status
  status      String       @default("pending")
  response    String?      @db.Text
  respondedAt DateTime?
  respondedBy String?
  
  createdAt   DateTime     @default(now())

  @@index([userId])
  @@index([type])
  @@index([status])
  @@map("feedback")
}

// ============================================
// ENUMS
// ============================================

enum AuthProvider {
  EMAIL
  PHONE
  GOOGLE
  APPLE
}

enum OtpType {
  EMAIL
  PHONE
}

enum OtpPurpose {
  REGISTRATION
  LOGIN
  FORGOT_PASSWORD
  VERIFICATION
}

enum SubscriptionTier {
  FREE
  PREMIUM
  PLATINUM
  ENTERPRISE
}

enum SubscriptionStatus {
  ACTIVE
  INACTIVE
  TRIALING
  PAST_DUE
  CANCELED
  UNPAID
}

enum Gender {
  MALE
  FEMALE
  OTHER
  PREFER_NOT_TO_SAY
}

enum ReadingLevel {
  BEGINNER
  INTERMEDIATE
  ADVANCED
}

enum StoryTheme {
  ADVENTURE
  FANTASY
  ANIMALS
  FRIENDSHIP
  BEDTIME
  EDUCATIONAL
  FAIRY_TALE
  SUPERHERO
  NATURE
  SPACE
  OCEAN
  DINOSAURS
  MAGIC
  MYSTERY
  FAMILY
  KINDNESS
  COURAGE
  CUSTOM
}

enum AgeGroup {
  TODDLER       // 2-3 years
  PRESCHOOL     // 4-5 years
  EARLY_READER  // 6-7 years
  MIDDLE_CHILD  // 8-10 years
  PRETEEN       // 11-12 years
}

enum StoryDuration {
  SHORT   // ~3-5 minutes
  MEDIUM  // ~5-10 minutes
  LONG    // ~10-15 minutes
}

enum VoiceType {
  CUSTOM   // User-uploaded voice
  PRESET   // Pre-made voices
  PREMIUM  // Premium voices
}

enum VoiceGender {
  MALE
  FEMALE
  NEUTRAL
}

enum VoiceAgeRange {
  CHILD
  YOUNG_ADULT
  ADULT
  SENIOR
}

enum VoiceStatus {
  PENDING
  PROCESSING
  READY
  FAILED
  DELETED
}

enum AudioStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

enum JobType {
  VOICE_CLONE
  STORY_GENERATE
  AUDIO_GENERATE
  FULL_STORY_PIPELINE
  BATCH_GENERATE
  EXPORT_DATA
  SEND_EMAIL
}

enum JobStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  CANCELLED
  RETRYING
}

enum PaymentStatus {
  PENDING
  PROCESSING
  SUCCEEDED
  FAILED
  REFUNDED
  CANCELED
}

enum PaymentMethod {
  CARD
  APPLE_PAY
  GOOGLE_PAY
  BANK_TRANSFER
  PAYPAL
}

enum ResourceType {
  STORY
  VOICE
  AUDIO
  STORAGE
  API_CALL
}

enum UsageAction {
  CREATED
  GENERATED
  CONSUMED
  DELETED
}

enum NotificationType {
  STORY_READY
  VOICE_READY
  SUBSCRIPTION_EXPIRING
  SUBSCRIPTION_RENEWED
  PAYMENT_SUCCESS
  PAYMENT_FAILED
  WEEKLY_DIGEST
  NEW_FEATURE
  SYSTEM
}

enum FeedbackType {
  BUG
  FEATURE_REQUEST
  GENERAL
  COMPLAINT
  PRAISE
}
```

---

# 🤖 Cursor AI Prompts for Building Backend

## Initial Setup Prompt

```
You are building a NestJS backend for "HearWithYou" - an AI-powered storytelling platform for children that uses voice cloning and AI-generated narratives.

TECH STACK:
- NestJS (latest version)
- Prisma ORM with PostgreSQL
- TypeScript (strict mode)
- Bull (Redis queue for background jobs)
- AWS S3 for storage
- OpenAI API for story generation
- ElevenLabs API for voice cloning and TTS
- Stripe for payments
- Passport JWT for authentication

ARCHITECTURE PRINCIPLES:
- Follow NestJS best practices and conventions
- Use dependency injection everywhere
- Implement proper error handling with custom exception filters
- Use DTOs for all request/response validation
- Implement proper logging with context
- Use database transactions where needed
- Implement proper rate limiting
- Cache frequently accessed data
- Use queues for long-running tasks
- Follow SOLID principles

EXISTING SETUP:
- Authentication module is already complete
- Prisma schema is defined (see attached schema.prisma)
- User model with subscription management exists

PROJECT STRUCTURE:
src/
├── common/
│   ├── decorators/
│   ├── guards/
│   ├── filters/
│   ├── interceptors/
│   └── pipes/
├── config/
├── modules/
│   ├── auth/ (already done)
│   ├── users/ (already done)
│   ├── voice/
│   ├── story/
│   ├── audio/
│   ├── storage/
│   ├── subscription/
│   ├── queue/
│   └── [other modules]
└── prisma/

Please help me build this backend step by step, following enterprise-level code quality standards.
```

---

## Module-by-Module Prompts

### 1. Voice Profile Module

```
Create a complete Voice Profile module for HearWithYou with the following requirements:

MODULE: VoiceProfileModule

FEATURES:
1. Upload audio samples (multiple files, MP3/WAV)
2. Validate audio quality and duration
3. Integrate with ElevenLabs voice cloning API
4. Store voice samples in AWS S3
5. Save voice profile metadata in database
6. Support CRUD operations for voice profiles
7. Track voice usage statistics
8. Handle voice cloning failures gracefully

FILES TO CREATE:
- voice-profile.module.ts
- voice-profile.controller.ts
- voice-profile.service.ts
- elevenlabs.service.ts
- dto/create-voice-profile.dto.ts
- dto/update-voice-profile.dto.ts
- dto/voice-profile-response.dto.ts
- interfaces/voice-profile.interface.ts

REQUIREMENTS:
- Use Multer for file uploads (max 5 files, 10MB each)
- Validate audio files (only audio/mpeg, audio/wav, audio/mp3)
- Extract audio metadata (duration, format, bitrate)
- Upload to S3 with organized folder structure
- Call ElevenLabs /voices/add endpoint
- Handle rate limiting for ElevenLabs API
- Implement proper error messages
- Add swagger documentation
- Implement user ownership validation
- Add subscription tier limits (FREE: 1 voice, PREMIUM: 3, PLATINUM: 10)

ELEVENLABS INTEGRATION:
- API endpoint: https://api.elevenlabs.io/v1
- Voice cloning: POST /voices/add
- Voice deletion: DELETE /voices/{voice_id}
- Get voices: GET /voices
- Use xi-api-key header for authentication

Use the existing Prisma VoiceProfile model and ensure proper relations with User model.
```

### 2. Story Generation Module

```
Create a complete Story Generation module with OpenAI integration:

MODULE: StoryModule

FEATURES:
1. Generate personalized stories using OpenAI GPT-4
2. Support multiple themes and age groups
3. Personalize stories with child's name and interests
4. Support multiple languages
5. Save stories to database
6. Implement story templates
7. Track story generation usage
8. Implement caching for similar requests

FILES TO CREATE:
- story.module.ts
- story.controller.ts
- story.service.ts
- openai.service.ts
- story-prompt.service.ts (prompt engineering)
- dto/create-story.dto.ts
- dto/story-response.dto.ts
- dto/generate-story.dto.ts
- interfaces/story-generation.interface.ts

REQUIREMENTS:
- Use OpenAI SDK (npm install openai)
- Implement sophisticated prompt engineering
- Support all StoryTheme and AgeGroup enums
- Validate age-appropriate content
- Handle rate limiting and errors
- Implement retry logic with exponential backoff
- Track token usage per request
- Check user's monthly story limits
- Support custom prompts with safety filters
- Generate title, content, and summary

PROMPT ENGINEERING:
- System prompts should be age-appropriate
- Include moral lessons
- Make stories engaging and natural for voice
- Use simple vocabulary for younger ages
- Include dialogue and sound effects suggestions
- Ensure stories are 300-1000 words based on duration
- Add personalization placeholders

OPENAI SETTINGS:
- Model: gpt-4 (fallback to gpt-3.5-turbo)
- Temperature: 0.8 for creativity
- Max tokens: 2000
- Presence penalty: 0.6
- Frequency penalty: 0.3

Implement proper usage tracking and enforce subscription limits.
```

### 3. Audio Generation Module

```
Create an Audio Generation module that converts stories to speech:

MODULE: AudioModule

FEATURES:
1. Convert story text to speech using ElevenLabs TTS
2. Use user's cloned voice
3. Upload generated audio to S3
4. Support streaming and download
5. Track audio generation usage
6. Handle long stories (chunking if needed)
7. Implement audio quality settings
8. Cache generated audio

FILES TO CREATE:
- audio.module.ts
- audio.controller.ts
- audio.service.ts
- audio-processor.service.ts (for chunking)
- dto/generate-audio.dto.ts
- dto/audio-response.dto.ts
- interfaces/audio-generation.interface.ts

REQUIREMENTS:
- Use ElevenLabs text-to-speech API
- Support both streaming and full generation
- Handle stories up to 10,000 characters
- Chunk long stories if needed (max 5000 chars per request)
- Use voice settings from VoiceProfile
- Upload to S3 with CDN-friendly paths
- Generate signed URLs for secure access
- Update Story model with audio metadata
- Handle generation failures gracefully
- Implement retry logic

ELEVENLABS TTS:
- Endpoint: POST /text-to-speech/{voice_id}
- Streaming: POST /text-to-speech/{voice_id}/stream
- Model: eleven_multilingual_v2
- Voice settings: stability, similarity_boost, style
- Output format: mp3_44100_128

S3 STRUCTURE:
- audio/{userId}/{storyId}/{uuid}.mp3
- Metadata: userId, storyId, duration, uploadedAt
- Content-Type: audio/mpeg
- Generate CloudFront URLs if available

Track characters used and update usage history.
```

### 4. Story Generation Orchestrator

```
Create a Story Generation Orchestrator that manages the complete pipeline:

MODULE: StoryGenerationModule

FEATURES:
1. Orchestrate full story creation pipeline
2. Generate story text (OpenAI)
3. Generate audio (ElevenLabs)
4. Store all assets
5. Support async processing with queues
6. Track pipeline status
7. Handle failures at any stage
8. Implement retry logic

FILES TO CREATE:
- story-generation.module.ts
- story-generation.controller.ts
- story-generation.service.ts
- story-pipeline.service.ts
- dto/full-story-request.dto.ts
- dto/pipeline-status.dto.ts
- interfaces/pipeline.interface.ts

WORKFLOW:
1. Validate request and check limits
2. Create story record (status: PENDING)
3. Generate story text via OpenAI
4. Update story with content
5. Queue audio generation job
6. Generate audio via ElevenLabs
7. Upload to S3
8. Update story with audio URL
9. Mark as COMPLETED

QUEUE INTEGRATION:
- Use Bull queue for async processing
- Job types: 'generate-story', 'generate-audio', 'full-pipeline'
- Implement job progress tracking
- Support job cancellation
- Retry failed jobs (max 3 attempts)
- Store job metadata in QueueJob model

API ENDPOINTS:
- POST /api/v1/stories/generate (create + queue)
- GET /api/v1/stories/:id/status (check status)
- GET /api/v1/stories/:id (get completed story)
- DELETE /api/v1/stories/:id (delete story)

MODES:
- Sync mode: Wait for completion (for short stories)
- Async mode: Queue and return job ID (default)
- Estimated time: Return based on story length

Handle partial failures and cleanup on errors.
```

### 5. Storage Module

```
Create a Storage module for AWS S3 integration:

MODULE: StorageModule

FEATURES:
1. Upload files to S3
2. Generate signed URLs
3. Delete files
4. Organize files by type and user
5. Handle multipart uploads for large files
6. Implement CDN integration
7. Track storage usage

FILES TO CREATE:
- storage.module.ts
- storage.service.ts
- storage.interface.ts
- dto/upload-result.dto.ts

REQUIREMENTS:
- Use @aws-sdk/client-s3
- Use @aws-sdk/s3-request-presigner
- Implement upload methods for:
  * Voice samples
  * Generated audio
  * Profile pictures
  * Exports
- Generate pre-signed URLs (1 hour expiry)
- Implement file deletion
- Track file sizes
- Use proper Content-Type headers

S3 CONFIGURATION:
- Bucket structure:
  * voice-samples/{userId}/{filename}
  * audio/{userId}/{storyId}/{uuid}.mp3
  * profiles/{userId}/{filename}
  * exports/{userId}/{timestamp}.zip
- Use server-side encryption
- Set proper ACLs
- Tag files with metadata

Implement proper error handling and logging.
```

### 6. Subscription & Payment Module

```
Create a Subscription and Payment module with Stripe:

MODULE: SubscriptionModule

FEATURES:
1. Manage subscription tiers (FREE, PREMIUM, PLATINUM)
2. Create Stripe checkout sessions
3. Handle webhooks
4. Track subscription status
5. Enforce usage limits
6. Support plan upgrades/downgrades
7. Handle cancellations
8. Process refunds

FILES TO CREATE:
- subscription.module.ts
- subscription.controller.ts
- subscription.service.ts
- stripe.service.ts
- webhook.controller.ts
- dto/create-checkout.dto.ts
- dto/subscription-response.dto.ts
- guards/subscription.guard.ts

SUBSCRIPTION LIMITS:
FREE:
  - 5 stories per month
  - 1 voice profile
  - 10 minute total audio per month

PREMIUM ($9.99/month):
  - 50 stories per month
  - 3 voice profiles
  - 2 hours total audio per month
  - Priority processing

PLATINUM ($19.99/month):
  - Unlimited stories
  - 10 voice profiles
  - Unlimited audio
  - Priority processing
  - Early access features

STRIPE INTEGRATION:
- Create products and prices in Stripe
- Use checkout sessions for payments
- Handle webhooks:
  * checkout.session.completed
  * customer.subscription.updated
  * customer.subscription.deleted
  * invoice.payment_succeeded
  * invoice.payment_failed
- Update user subscription status
- Track subscription history
- Handle trial periods

Implement usage enforcement guards and decorators.
```

### 7. Queue Module (Bull/Redis)

```
Create a Queue module for background job processing:

MODULE: QueueModule

FEATURES:
1. Process story generation jobs
2. Process audio generation jobs
3. Handle retries and failures
4. Track job progress
5. Implement job priorities
6. Support job cancellation
7. Clean up old jobs

FILES TO CREATE:
- queue.module.ts
- queue.service.ts
- processors/story.processor.ts
- processors/audio.processor.ts
- processors/cleanup.processor.ts
- interfaces/job.interface.ts

QUEUES:
1. story-generation
   - Jobs: generate-text, full-pipeline
   - Priority: PREMIUM users get priority
   - Concurrency: 5

2. audio-generation
   - Jobs: generate-audio, chunk-audio
   - Priority: Based on user tier
   - Concurrency: 3

3. cleanup
   - Jobs: delete-old-jobs, cleanup-temp-files
   - Schedule: Daily

REQUIREMENTS:
- Use @nestjs/bull
- Implement job progress tracking
- Update QueueJob model in database
- Implement proper error handling
- Support job cancellation
- Clean up completed jobs after 7 days
- Implement rate limiting per user
- Add job metrics and logging

PROCESSORS:
- Inject required services
- Handle failures gracefully
- Update database on completion
- Emit events for real-time updates
- Implement retry logic (max 3 attempts)

Use proper logging and monitoring.
```

### 8. Analytics & Usage Module

```
Create an Analytics module for usage tracking:

MODULE: AnalyticsModule

FEATURES:
1. Track story generation
2. Track audio playback
3. Track API usage
4. Generate usage reports
5. Monitor costs (OpenAI, ElevenLabs)
6. Track user engagement
7. Support admin dashboards

FILES TO CREATE:
- analytics.module.ts
- analytics.service.ts
- usage-tracker.service.ts
- cost-calculator.service.ts
- dto/usage-report.dto.ts
- dto/analytics-stats.dto.ts

TRACKING:
- Story generations per user
- Audio generation metrics
- Voice profile usage
- Playback statistics
- API costs per user
- Monthly usage trends
- Peak usage times

DATABASE:
- Use UsageHistory model
- Use PlayHistory model
- Aggregate data for reports
- Implement efficient queries

API ENDPOINTS:
- GET /api/v1/analytics/usage (user's usage)
- GET /api/v1/analytics/costs (user's costs)
- GET /api/v1/admin/analytics/overview (admin)
- GET /api/v1/admin/analytics/users (admin)

Implement caching and efficient aggregations.
```

### 9. Notification Module

```
Create a Notification module:

MODULE: NotificationModule

FEATURES:
1. Push notifications
2. Email notifications
3. In-app notifications
4. Notification preferences
5. Batch notifications
6. Scheduled notifications

FILES TO CREATE:
- notification.module.ts
- notification.service.ts
- email.service.ts
- push.service.ts
- dto/notification.dto.ts
- templates/ (email templates)

NOTIFICATION TYPES:
- Story ready
- Voice cloning complete
- Subscription expiring
- Payment success/failure
- Weekly digest
- New features

INTEGRATIONS:
- SendGrid for emails
- Firebase Cloud Messaging for push
- Store in Notification model

Use proper templating and user preferences.
```

### 10. Admin Dashboard API

```
Create admin APIs for the Next.js dashboard:

MODULE: AdminModule

FEATURES:
1. User management
2. Story moderation
3. Subscription management
4. Usage analytics
5. System health monitoring
6. Content moderation

FILES TO CREATE:
- admin.module.ts
- admin.controller.ts
- admin.service.ts
- guards/admin.guard.ts
- dto/admin-stats.dto.ts

ENDPOINTS:
- GET /api/v1/admin/users
- GET /api/v1/admin/stories
- GET /api/v1/admin/stats
- PATCH /api/v1/admin/users/:id
- DELETE /api/v1/admin/stories/:id

Implement proper role-based access control.
```

---

## Complete Backend Generation Prompt

```
I need you to help me build the complete backend for HearWithYou following this plan:

PHASE 1: Core Infrastructure (Week 1)
□ Set up NestJS project structure
□ Configure Prisma with existing schema
□ Set up environment configuration
□ Implement error handling and logging
□ Set up Redis and Bull queue
□ Configure AWS S3
□ Set up Swagger documentation

PHASE 2: Voice & Storage (Week 2)
□ Build Storage module (S3 integration)
□ Build Voice Profile module
□ Integrate ElevenLabs voice cloning
□ Implement voice sample upload
□ Add voice profile CRUD operations

PHASE 3: Story Generation (Week 3)
□ Build Story module
□ Integrate OpenAI for story generation
□ Implement prompt engineering service
□ Add story CRUD operations
□ Implement usage limits

PHASE 4: Audio Generation (Week 4)
□ Build Audio module
□ Integrate ElevenLabs TTS
□ Implement audio upload to S3
□ Add streaming support
□ Handle chunking for long stories

PHASE 5: Orchestration (Week 5)
□ Build Story Generation Orchestrator
□ Implement queue processors
□ Add pipeline status tracking
□ Implement retry logic
□ Add real-time updates

PHASE 6: Subscriptions (Week 6)
□ Build Subscription module
□ Integrate Stripe
□ Implement webhook handlers
□ Add usage enforcement
□ Implement plan management

PHASE 7: Additional Features (Week 7)
□ Build Analytics module
□ Build Notification module
□ Implement favorites & ratings
□ Add play history tracking
□ Build Admin APIs

PHASE 8: Testing & Optimization (Week 8)
□ Write unit tests
□ Write integration tests
□ Implement caching
□ Optimize database queries
□ Add performance monitoring

For each phase, provide:
1. Complete, production-ready code
2. Proper error handling
3. Validation and security
4. Swagger documentation
5. Logging and monitoring
6. Tests

Let's start with PHASE 1. Please generate the complete infrastructure setup.
```

---

## Quick Generation Prompts

### For Each Service

```
Generate a complete {ServiceName}Service with:

1. Proper dependency injection
2. Error handling with custom exceptions
3. Logging with context
4. Input validation
5. Database transactions where needed
6. Proper TypeScript types
7. JSDoc documentation
8. Unit test examples

Follow NestJS best practices and enterprise patterns.
```

### For Each Controller

```
Generate a {ControllerName}Controller with:

1. All CRUD endpoints
2. Proper DTOs for validation
3. Swagger documentation
4. Authentication guards
5. Rate limiting
6. Proper HTTP status codes
7. Error responses
8. Request/response transformers

Use class-validator and class-transformer.
```

### For Each DTO

```
Generate DTOs for {FeatureName} with:

1. Request DTOs with validation decorators
2. Response DTOs with proper mapping
3. Swagger decorators
4. Type safety
5. Transformation rules

Include: Create, Update, Response, Query DTOs as needed.
```



Please make sure env should be validate , response should be standard

and make sure pagination response should be standard as well.

Make sure the summary, description, paths should be defined in separate folder/file.ts and make sure they are get by objectName.key.value and response message should be separate for fail and success and everyhting look legit

so everything is structure and maintainable

Please make sure to complete things in one go.

Please remeber api key for open ai and eleven labs will be enter from dashboard so make sure to secure them correctly.


Please make sure that the code can handle 1k to 5k user concurrently at code level.