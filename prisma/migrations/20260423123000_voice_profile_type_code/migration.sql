ALTER TABLE "voice_profiles"
ADD COLUMN "type_code" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "voice_profiles"
ADD CONSTRAINT "voice_profiles_type_code_range_check"
CHECK ("type_code" >= 0 AND "type_code" <= 6);

CREATE INDEX "voice_profiles_type_code_idx" ON "voice_profiles"("type_code");
