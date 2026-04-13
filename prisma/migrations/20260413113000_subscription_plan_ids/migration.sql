-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "code" "SubscriptionTier" NOT NULL,
    "displayName" TEXT NOT NULL,
    "displayPrice" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billingPeriod" TEXT NOT NULL DEFAULT 'month',
    "storiesPerMonth" INTEGER NOT NULL DEFAULT 5,
    "voiceProfiles" INTEGER NOT NULL DEFAULT 1,
    "storeProductIdIos" TEXT,
    "storeProductIdAndroid" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "users" ADD COLUMN "currentSubscriptionPlanId" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN "subscriptionPlanId" TEXT;

-- AlterTable
ALTER TABLE "subscription_history" ADD COLUMN "subscriptionPlanId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_code_key" ON "subscription_plans"("code");
CREATE INDEX "subscription_plans_code_idx" ON "subscription_plans"("code");
CREATE INDEX "subscription_plans_isActive_idx" ON "subscription_plans"("isActive");
CREATE INDEX "users_currentSubscriptionPlanId_idx" ON "users"("currentSubscriptionPlanId");
CREATE INDEX "payments_subscriptionPlanId_idx" ON "payments"("subscriptionPlanId");
CREATE INDEX "subscription_history_subscriptionPlanId_idx" ON "subscription_history"("subscriptionPlanId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_currentSubscriptionPlanId_fkey" FOREIGN KEY ("currentSubscriptionPlanId") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscriptionPlanId_fkey" FOREIGN KEY ("subscriptionPlanId") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_subscriptionPlanId_fkey" FOREIGN KEY ("subscriptionPlanId") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default plans
INSERT INTO "subscription_plans" (
    "id", "code", "displayName", "displayPrice", "currency", "billingPeriod", "storiesPerMonth", "voiceProfiles", "storeProductIdIos", "storeProductIdAndroid", "isActive", "updatedAt"
)
VALUES
    ('plan_free', 'FREE', 'Basic', 0, 'USD', 'none', 5, 1, '', '', true, CURRENT_TIMESTAMP),
    ('plan_premium', 'PREMIUM', 'Premium', 9.99, 'USD', 'month', 50, 3, '', '', true, CURRENT_TIMESTAMP),
    ('plan_platinum', 'PLATINUM', 'Platinum', 19.99, 'USD', 'month', 1000000, 10, '', '', true, CURRENT_TIMESTAMP),
    ('plan_enterprise', 'ENTERPRISE', 'Enterprise', 49.99, 'USD', 'month', 1000000, 10, '', '', false, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Backfill users by tier
UPDATE "users" u
SET "currentSubscriptionPlanId" = p."id"
FROM "subscription_plans" p
WHERE p."code" = u."subscriptionTier";

-- Backfill history by tier
UPDATE "subscription_history" sh
SET "subscriptionPlanId" = p."id"
FROM "subscription_plans" p
WHERE p."code" = sh."tier";
