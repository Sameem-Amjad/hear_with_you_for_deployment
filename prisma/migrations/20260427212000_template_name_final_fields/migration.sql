-- Final template shape: name, prompt, svg, flags, timestamps.
ALTER TABLE "story_templates"
ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT '';

-- Remove deprecated template fields now that the contract is narrowed.
ALTER TABLE "story_templates"
DROP COLUMN IF EXISTS "template_svg_key",
DROP COLUMN IF EXISTS "template_svg_url";

-- Keep existing flag defaults aligned with the frontend contract.
ALTER TABLE "story_templates"
ALTER COLUMN "isFeatured" SET DEFAULT true,
ALTER COLUMN "is_published" SET DEFAULT true,
ALTER COLUMN "isActive" SET DEFAULT true;
