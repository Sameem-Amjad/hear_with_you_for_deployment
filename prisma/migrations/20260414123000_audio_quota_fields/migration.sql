-- AlterTable
ALTER TABLE "users"
ADD COLUMN "audioGeneratedThisMonth" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "subscription_plans"
ADD COLUMN "audioGenerationsPerMonth" INTEGER NOT NULL DEFAULT 5;
