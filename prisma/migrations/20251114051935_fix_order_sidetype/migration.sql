-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "marketId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "sideType" TEXT,
    "orderType" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "filledQty" REAL NOT NULL DEFAULT 0,
    "fillPrice" REAL,
    "status" TEXT NOT NULL,
    "limitPrice" REAL,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "MarketCache" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("createdAt", "expiresAt", "fillPrice", "filledQty", "id", "limitPrice", "marketId", "orderType", "quantity", "side", "sideType", "status", "userId") SELECT "createdAt", "expiresAt", "fillPrice", "filledQty", "id", "limitPrice", "marketId", "orderType", "quantity", "side", "sideType", "status", "userId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
