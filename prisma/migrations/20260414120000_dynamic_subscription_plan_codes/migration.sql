-- AlterTable
ALTER TABLE "subscription_plans"
ALTER COLUMN "code" TYPE TEXT USING "code"::text;
