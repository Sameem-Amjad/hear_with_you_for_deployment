-- -- Prune unused columns to keep schema minimal based on current API/service usage

-- ALTER TABLE "users"
--   DROP COLUMN "trialEndsAt",
--   DROP COLUMN "monthlyResetDate";

-- ALTER TABLE "child_profiles"
--   DROP COLUMN "dateOfBirth",
--   DROP COLUMN "gender",
--   DROP COLUMN "avatar",
--   DROP COLUMN "readingLevel",
--   DROP COLUMN "preferredThemes",
--   DROP COLUMN "preferredDuration",
--   DROP COLUMN "bedtime";

-- ALTER TABLE "voice_profiles"
--   DROP COLUMN "gender",
--   DROP COLUMN "ageRange",
--   DROP COLUMN "accent";

-- ALTER TABLE "stories"
--   DROP COLUMN "moralLesson",
--   DROP COLUMN "wordCount",
--   DROP COLUMN "estimatedReadTime",
--   DROP COLUMN "customElements",
--   DROP COLUMN "averageRating",
--   DROP COLUMN "isReported",
--   DROP COLUMN "reportReason";

-- ALTER TABLE "notifications"
--   DROP COLUMN "actionUrl",
--   DROP COLUMN "actionText";

-- ALTER TABLE "story_templates"
--   DROP COLUMN "usageCount";

-- ALTER TABLE "feedback"
--   DROP COLUMN "rating";

-- DROP TYPE "Gender";
-- DROP TYPE "ReadingLevel";
-- DROP TYPE "VoiceGender";
-- DROP TYPE "VoiceAgeRange";
