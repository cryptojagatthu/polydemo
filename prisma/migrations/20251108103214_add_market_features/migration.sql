-- CreateTable
CREATE TABLE "Bookmark" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "marketId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bookmark_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "MarketCache" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MarketCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "eventSlug" TEXT,
    "question" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "outcomePricesJson" TEXT NOT NULL,
    "outcomeLabelsJson" TEXT NOT NULL DEFAULT '["Yes","No"]',
    "endDate" DATETIME,
    "active" BOOLEAN NOT NULL,
    "closed" BOOLEAN NOT NULL,
    "volume" REAL,
    "volume24h" REAL DEFAULT 0,
    "volume7d" REAL DEFAULT 0,
    "volume30d" REAL DEFAULT 0,
    "category" TEXT DEFAULT 'General',
    "lastSynced" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_MarketCache" ("active", "closed", "eventSlug", "id", "lastSynced", "outcomePricesJson", "question", "slug", "volume") SELECT "active", "closed", "eventSlug", "id", "lastSynced", "outcomePricesJson", "question", "slug", "volume" FROM "MarketCache";
DROP TABLE "MarketCache";
ALTER TABLE "new_MarketCache" RENAME TO "MarketCache";
CREATE UNIQUE INDEX "MarketCache_slug_key" ON "MarketCache"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_userId_marketId_key" ON "Bookmark"("userId", "marketId");
