-- Drop Feedback table
DROP TABLE IF EXISTS "feedback" CASCADE;

-- Drop Favorite table
DROP TABLE IF EXISTS "favorites" CASCADE;

-- Drop StoryRating table
DROP TABLE IF EXISTS "story_ratings" CASCADE;

-- Drop UserSettings table
DROP TABLE IF EXISTS "user_settings" CASCADE;

-- Drop StripeWebhookEvent table
DROP TABLE IF EXISTS "stripe_webhook_events" CASCADE;

-- Drop ChildProfile table (must be last due to foreign key constraints)
DROP TABLE IF EXISTS "child_profiles" CASCADE;

-- Remove columns from Story table
ALTER TABLE "stories" DROP COLUMN IF EXISTS "childProfileId";
ALTER TABLE "stories" DROP COLUMN IF EXISTS "wordCount";
ALTER TABLE "stories" DROP COLUMN IF EXISTS "estimatedReadTime";
ALTER TABLE "stories" DROP COLUMN IF EXISTS "customElements";
ALTER TABLE "stories" DROP COLUMN IF EXISTS "elevenLabsCharactersUsed";

-- Remove columns from PlayHistory table
ALTER TABLE "play_history" DROP COLUMN IF EXISTS "childProfileId";

-- Remove columns from Payment table
ALTER TABLE "payments" DROP COLUMN IF EXISTS "stripePaymentIntentId";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "stripeChargeId";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "stripeInvoiceId";

-- Remove columns from SubscriptionHistory table
ALTER TABLE "subscription_history" DROP COLUMN IF EXISTS "stripeSubscriptionId";
ALTER TABLE "subscription_history" DROP COLUMN IF EXISTS "stripeInvoiceId";
