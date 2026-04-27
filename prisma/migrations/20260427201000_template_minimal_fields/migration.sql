-- Keep only minimal template fields required by frontend/admin.
ALTER TABLE "story_templates"
ADD COLUMN IF NOT EXISTS "template_svg_key" TEXT,
ADD COLUMN IF NOT EXISTS "template_svg_url" TEXT,
ADD COLUMN IF NOT EXISTS "template_prompt" TEXT;

-- Move existing prompt content into the new template_prompt column.
UPDATE "story_templates"
SET "template_prompt" = COALESCE("template_prompt", "promptTemplate", '');

ALTER TABLE "story_templates"
ALTER COLUMN "template_prompt" SET NOT NULL,
ALTER COLUMN "isFeatured" SET DEFAULT true,
ALTER COLUMN "is_published" SET DEFAULT true,
ALTER COLUMN "isActive" SET DEFAULT true;

-- Enforce defaults for existing rows as requested.
UPDATE "story_templates"
SET "isFeatured" = true,
    "is_published" = true,
    "isActive" = true
WHERE "isFeatured" IS DISTINCT FROM true
   OR "is_published" IS DISTINCT FROM true
   OR "isActive" IS DISTINCT FROM true;

-- Remove no-longer-needed template columns.
ALTER TABLE "story_templates"   
DROP COLUMN IF EXISTS "description",
DROP COLUMN IF EXISTS "theme",
DROP COLUMN IF EXISTS "ageGroup",
DROP COLUMN IF EXISTS "promptTemplate",
DROP COLUMN IF EXISTS "placeholders",
DROP COLUMN IF EXISTS "published_at",
DROP COLUMN IF EXISTS "thumbnailUrl",
DROP COLUMN IF EXISTS "tags",
DROP COLUMN IF EXISTS "usageCount";
