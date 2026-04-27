-- Add publish/unpublish and svg support for story templates
ALTER TABLE "story_templates"
ADD COLUMN "is_published" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "published_at" TIMESTAMP(3),
ADD COLUMN "template_svg" TEXT;

-- Keep currently active templates visible to existing clients
UPDATE "story_templates"
SET "is_published" = true,
    "published_at" = NOW()
WHERE "isActive" = true;

CREATE INDEX "story_templates_is_active_is_published_is_featured_idx"
ON "story_templates"("isActive", "is_published", "isFeatured");

DROP INDEX IF EXISTS "story_templates_is_active_is_featured_idx";
