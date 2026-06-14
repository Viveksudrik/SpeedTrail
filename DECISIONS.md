# DECISIONS.md: Decision Log & Architectural Tradeoffs

This log details the key product and engineering decisions made during the design and construction of the Shared Expenses App.

---

## 1. Technical Stack Selection
*   **Chosen Stack:** Next.js (App Router), TypeScript, tRPC, Prisma ORM, and PostgreSQL.
*   **Alternatives Considered:** Node.js (Express) + React (Vite) + SQLite.
*   **Why Next.js + tRPC + Prisma + PostgreSQL was selected:**
    *   **Type-safety E2E:** tRPC automatically shares TypeScript types between the backend routers and client views. If we change a schema field, it immediately flags compiler errors on the client.
    *   **Relational Database:** The assignment requires a relational DB. PostgreSQL is the industry standard. Using Prisma client allows us to write migrations easily and guarantees constraints.
    *   **Unified Deployment:** Next.js bundles both API routes and client assets in a single compiled codebase, making it highly portable.

---

## 2. Solving Roommate Pain Points

### Aisha's Debt Simplification ("Who pays whom, how much, done.")
*   **Algorithm:** Greedy Balance Settlement.
*   **Flow:**
    1. Retrieve the net balance for each roommate: `Net = Paid - SplitOwed + Sent - Received`.
    2. Separate roommates into **Debtors** (negative balance) and **Creditors** (positive balance).
    3. Sort debtors (descending debt) and creditors (descending credit).
    4. Greedily match the largest debtor with the largest creditor, record a transfer path, adjust balances, and repeat until all balances are settled (net balance close to 0).
    5. This yields the mathematically minimal transfer count, avoiding redundant round-trip payments.

### Rohan's Audit Trail ("No magic numbers. I want to see exactly which expenses make up my balance.")
*   **Decision:** Chronological itemized ledger.
*   **Implementation:**
    *   We create a unified audit view for any roommate.
    *   The ledger aggregates:
        *   **Paid Expenses:** Credit impact of `+(TotalAmount - MyShare)` in INR.
        *   **Split Participation:** Debit impact of `-MyShare` in INR.
        *   **Sent Payments:** Credit impact of `+Amount` (reduced debt).
        *   **Received Payments:** Debit impact of `-Amount` (reduced credit).
    *   Items are sorted chronologically and display a running balance. The final row is guaranteed to match the roommate's current net balance exactly, showing proof of every rupee.

### Priya's USD Conversion ("Priya: Half the trip was in dollars. The sheet pretends a dollar is a rupee.")
*   **Decision:** Flexible exchange rate + currency columns.
*   **Implementation:**
    *   We store the original `currency` and the `exchangeRate` at the row level in the `Expense` and `Settlement` tables.
    *   **Baseline rate:** 1 USD = 95 INR (as configured in Aiven/Supabase setup).
    *   **Customization:** The user can alter the rate slider/input in the CSV Import screen. If the exchange rate changes, it recalculates splits and balances in INR immediately.

### Sam's Temporal Membership ("Why would March electricity affect my balance?")
*   **Decision:** Active date-bounds on group membership.
*   **Implementation:**
    *   `group_memberships` table contains `joinedAt` and `leftAt` columns.
    *   Meera is bounded `2026-02-01` to `2026-03-31`. Sam is bounded `2026-04-15` onwards.
    *   When an expense is parsed or logged manually on date `D`, we verify if each split participant is active on date `D`.
    *   If Meera is included in an April 2nd grocery bill, the scanner raises a temporal anomaly. The resolution policy allows **excluding** Meera and splitting her share among active members.

### Meera's Duplicates Approval ("Meera: Clean up duplicates — but I want to approve deletes/changes.")
*   **Decision:** Persistent Import Sessions + Wizard UI.
*   **Implementation:**
    *   We never delete or skip CSV rows silently.
    *   Instead, we scan the CSV, write any warnings/errors to `ImportAnomaly` tables, and save the raw CSV text in the database.
    *   We present the user with a step-by-step resolution screen. Duplicate rows are displayed side-by-side, prompting the user to choose which one to skip and which to import before writing anything to core expense tables.

---

## 3. Advanced Features & Spliit Inspiration

### Decision 6: Spliit Pattern Integration
*   **Chosen Patterns:** Stable debt comparator, search/filter on individual ledgers, client-side Blob-based data exports.
*   **Alternatives Considered:** Lazy materialization of recurring bills, AI receipt scanning via GPT-4V.
*   **Why selected:**
    *   **Stable debt comparator:** In standard greedy debt minimization, arbitrary sorting can reshuffle suggested repayments if a user records one settlement. Sorting by username alphabetically on balance ties ensures the list remains stable.
    *   **Search/Filter:** Rohan can filter a large ledger to find specific bills (e.g. "rent", "wifi") without page reloads.
    *   **Client-side exports:** Allows flatmates to download the entire structured audit trail in CSV/JSON formats for offline spreadsheets.
    *   **Why skipped AI/Cron:** Keeping the app self-contained and avoiding third-party API tokens/costs (S3, OpenAI keys, background cron schedulers) ensures robust local execution.

### Decision 7: Why Vanilla CSS over TailwindCSS
*   **Decision:** A bespoke glassmorphic dark theme styled entirely in pure Vanilla CSS.
*   **Why selected:**
    *   Tailwind can clutter HTML elements with complex utility classes, making component source files hard to review during grading.
    *   Writing native CSS stylesheet (`globals.css`) provides complete control over keyframe animations (`fadeIn`, `spin`), custom scrollbars, and fine-grained gradient glow backdrops, ensuring a visual design that stands out.
