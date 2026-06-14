# SCOPE.md: Database Schema & Anomaly Log

This file documents the relational database schema used for the Shared Expenses App and records how each of the 16 deliberate data anomalies in `expenses_export.csv` is detected, surfaced, and resolved by the importer.

---

## 1. Database Schema

The application uses **PostgreSQL** (hosted on Supabase) and is managed via **Prisma ORM**. Below is the Prisma schema schema definitions:

```prisma
datasource db {
    provider  = "postgresql"
    url       = env("DATABASE_URL")
    directUrl = env("DIRECT_URL")
}

generator client {
    provider = "prisma-client-js"
}

model User {
  id                  String            @id @default(uuid())
  username            String            @unique
  passwordHash        String
  createdAt           DateTime          @default(now())
  memberships         GroupMembership[]
  paidExpenses        Expense[]         @relation("PaidExpenses")
  splits              Split[]
  sentSettlements     Settlement[]      @relation("SentSettlements")
  receivedSettlements Settlement[]      @relation("ReceivedSettlements")
}

model Group {
  id          String            @id @default(uuid())
  name        String
  createdAt   DateTime          @default(now())
  memberships GroupMembership[]
  expenses    Expense[]
  settlements Settlement[]
}

model GroupMembership {
  id       String    @id @default(uuid())
  groupId  String
  userId   String
  joinedAt DateTime
  leftAt   DateTime?
  group    Group     @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([groupId, userId])
}

model Expense {
  id           String   @id @default(uuid())
  groupId      String
  description  String
  amount       Decimal  @db.Decimal(12, 2)
  currency     String   // "INR" or "USD"
  exchangeRate Float    // 1 original_currency = X INR
  paidById     String
  splitType    String   // "equal", "unequal", "percentage", "share"
  date         DateTime
  notes        String?
  createdAt    DateTime @default(now())
  group        Group    @relation(fields: [groupId], references: [id], onDelete: Cascade)
  paidBy       User     @relation("PaidExpenses", fields: [paidById], references: [id], onDelete: Cascade)
  splits       Split[]
}

model Split {
  id        String   @id @default(uuid())
  expenseId String
  userId    String
  amount    Decimal  @db.Decimal(12, 2)
  percent   Float?
  share     Float?
  expense   Expense  @relation(fields: [expenseId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Settlement {
  id           String   @id @default(uuid())
  groupId      String
  fromUserId   String
  toUserId     String
  amount       Decimal  @db.Decimal(12, 2)
  currency     String
  exchangeRate Float
  date         DateTime
  notes        String?
  createdAt    DateTime @default(now())
  group        Group    @relation(fields: [groupId], references: [id], onDelete: Cascade)
  fromUser     User     @relation("SentSettlements", fields: [fromUserId], references: [id], onDelete: Cascade)
  toUser       User     @relation("ReceivedSettlements", fields: [toUserId], references: [id], onDelete: Cascade)
}

model ImportSession {
  id         String          @id @default(uuid())
  status     String          // "PENDING_APPROVAL", "COMPLETED"
  csvText    String          // Storing raw CSV for serverless safety
  createdAt  DateTime        @default(now())
  anomalies  ImportAnomaly[]
}

model ImportAnomaly {
  id               String        @id @default(uuid())
  importSessionId  String
  rowNumber        Int
  rawData          String        // JSON string of raw row
  anomalyType      String
  severity         String        // "WARNING", "CRITICAL"
  description      String
  resolutionStatus String        @default("PENDING") // "PENDING", "RESOLVED", "IGNORED"
  resolutionChoice String?
  importSession    ImportSession @relation(fields: [importSessionId], references: [id], onDelete: Cascade)
}
```

---

## 2. Anomaly Resolution Log

The importer scans `expenses_export.csv` and highlights these 16 data anomalies, allowing the user (e.g., Meera) to interactively approve the resolution policy:

| Row # | CSV Date | Description | Detected Anomaly | Severity | Resolution Policy applied |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **5 & 6** | `08-02-2026` | Dinner at Marina Bites / dinner - marina bites | Duplicate listings (same date, payer, amount) | **WARNING** | Flagged. Left row imported; right duplicate row skipped. |
| **7** | `10-02-2026` | Electricity Feb | Quoted/comma amount `"1,200"` | **WARNING** | Stripped quotes and commas, parsing amount as numeric `1200.00`. |
| **9** | `14-02-2026` | Movie night snacks | Payer name casing inconsistency (`priya`) | **WARNING** | Normalized name string to capitalized `Priya` mapping. |
| **10** | `15-02-2026` | Cylinder refill | Floating point precision (`899.995`) | **WARNING** | Highlighted decimal length and rounded value to `900.00` INR. |
| **11** | `18-02-2026` | Groceries DMart | Payer name variation (`Priya S`) | **WARNING** | Mapped `Priya S` to standard flat user `Priya`. |
| **13** | `22-02-2026` | House cleaning supplies | Missing payer field | **CRITICAL** | Surface selector; user chooses payer (e.g., `Rohan`) during import. |
| **14** | `25-02-2026` | Rohan paid Aisha back | Settlement logged as group expense | **WARNING** | Flagged. Converted directly to `Settlement` from Rohan to Aisha, adjusting balances directly. |
| **15** | `28-02-2026` | Pizza Friday | Percentage splits sum to **110%** | **CRITICAL** | Flagged. Pro-rated percentages proportionally (scaled to sum to 100%). |
| **20** | `09-03-2026` | Goa villa booking | Multi-currency transaction (USD) | **WARNING** | Converted USD to INR using default user rate (1 USD = 95 INR). |
| **21** | `10-03-2026` | Beach shack lunch | Multi-currency transaction (USD) | **WARNING** | Converted USD to INR (1 USD = 95 INR). |
| **23** | `11-03-2026` | Parasailing | Non-group member split (`Dev's friend Kabir`) | **WARNING** | Kabir excluded. Kabir's share assigned to Dev (payer) as his guest. |
| **24 & 25** | `11-03-2026` | Dinner at Thalassa / Thalassa dinner | Conflicting logs (Aisha logged 2400, Rohan logged 2450) | **WARNING** | Flagged. Rohan's row kept; Aisha's row skipped as duplicate. |
| **26** | `12-03-2026` | Parasailing refund | Negative transaction amount | **WARNING** | Ingested as negative split amount, reducing what members owed. |
| **27** | `Mar-14` | Airport cab | Inconsistent date format (`Mar-14`) / Payer trailing space (`rohan `) | **WARNING** | Parsed date to `2026-03-14`. Trimmed trailing spaces from name. |
| **28** | `15-03-2026` | Groceries DMart | Missing currency code | **WARNING** | Defaulted to group base currency `INR`. |
| **31** | `22-03-2026` | Dinner order Swiggy | Zero amount (`0`) | **WARNING** | Alerted user. Ingested as 0 value expense as requested in notes. |
| **32** | `25-03-2026` | Weekend brunch | Percentage splits sum to **110%** | **CRITICAL** | Pro-rated percentages proportionally (scaled to sum to 100%). |
| **34** | `04-05-2026` | Deep cleaning service | Date format ambiguity (May 4th or April 5th?) | **WARNING** | User selected DD-MM representation (`May 4, 2026`). |
| **36** | `02-04-2026` | Groceries BigBasket | Split includes inactive member (Meera in April) | **WARNING** | Excluded Meera (who left Mar 31) and split among remaining active members. |
| **38** | `08-04-2026` | Sam deposit share | Direct deposit settlement | **WARNING** | Converted to direct settlement between Sam and Aisha. |
| **42** | `18-04-2026` | Furniture for common room | Redundant split details in equal split | **WARNING** | Imported as equal split. |
