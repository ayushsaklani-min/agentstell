-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "stellarAddress" TEXT NOT NULL,
    "email" TEXT,
    "description" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "totalEarnings" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ApiListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "longDescription" TEXT,
    "category" TEXT NOT NULL,
    "priceUsdc" REAL NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'GET',
    "contentType" TEXT NOT NULL DEFAULT 'application/json',
    "requestSchema" TEXT,
    "responseSchema" TEXT,
    "exampleRequest" TEXT,
    "exampleResponse" TEXT,
    "params" TEXT,
    "sideEffectLevel" TEXT NOT NULL DEFAULT 'read',
    "latencyHint" TEXT NOT NULL DEFAULT 'fast',
    "idempotent" BOOLEAN NOT NULL DEFAULT true,
    "providerId" TEXT NOT NULL,
    "totalCalls" INTEGER NOT NULL DEFAULT 0,
    "successRate" REAL NOT NULL DEFAULT 100,
    "avgLatencyMs" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isProxied" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApiListing_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApiCall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apiListingId" TEXT NOT NULL,
    "callerAddress" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "amountUsdc" REAL NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "latencyMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiCall_apiListingId_fkey" FOREIGN KEY ("apiListingId") REFERENCES "ApiListing" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentBudget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletAddress" TEXT NOT NULL,
    "totalBudget" REAL NOT NULL,
    "spentAmount" REAL NOT NULL DEFAULT 0,
    "remainingBudget" REAL NOT NULL,
    "maxPerCall" REAL,
    "maxPerSession" REAL,
    "contractAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MarketplaceStats" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
    "totalApis" INTEGER NOT NULL DEFAULT 0,
    "totalProviders" INTEGER NOT NULL DEFAULT 0,
    "totalCalls" INTEGER NOT NULL DEFAULT 0,
    "totalVolumeUsdc" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WantedPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "budgetUsdc" REAL NOT NULL,
    "posterAddress" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Provider_stellarAddress_key" ON "Provider"("stellarAddress");

-- CreateIndex
CREATE UNIQUE INDEX "ApiListing_slug_key" ON "ApiListing"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ApiCall_txHash_key" ON "ApiCall"("txHash");

-- CreateIndex
CREATE UNIQUE INDEX "AgentBudget_walletAddress_key" ON "AgentBudget"("walletAddress");
