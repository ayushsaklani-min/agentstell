-- AlterTable
ALTER TABLE "ApiListing" ADD COLUMN "healthCheckedAt" DATETIME;
ALTER TABLE "ApiListing" ADD COLUMN "healthLatencyMs" INTEGER;
ALTER TABLE "ApiListing" ADD COLUMN "healthStatus" TEXT;
