# 🛣️ SpeedTrail - Shared Flatmate Expenses App

SpeedTrail is a high-fidelity, production-grade shared expenses management application designed specifically to parse, reconcile, and manage roommate ledgers with complex, temporal group memberships and currency conversions.

Originally built to clean up a messy, anomaly-ridden flatmate spreadsheet, SpeedTrail incorporates time-bound occupancy rules, a greedy debt-simplification network, an itemized chronological audit ledger, and a comprehensive CSV ingestion wizard with manual anomaly approval.

- **Production Deployed App:** [https://speedtrail.vercel.app/](https://speedtrail.vercel.app/)
- **GitHub Repository:** [https://github.com/Viveksudrik/SpeedTrail](https://github.com/Viveksudrik/SpeedTrail)
- **Deliberate Anomaly Log:** Detailed in [SCOPE.md](./SCOPE.md)
- **Architectural & Design Decisions:** Detailed in [DECISIONS.md](./DECISIONS.md)
- **AI Collaboration & Prompt Engineering Log:** Detailed in [AI_USAGE.md](./AI_USAGE.md)

---

## 🛠️ Tech Stack & Architecture

- **Framework:** Next.js 15 (App Router, Server Components)
- **Language:** TypeScript
- **API Layers:** tRPC v11 (E2E compile-time type-safety)
- **Database ORM:** Prisma ORM
- **Database Engine:** PostgreSQL (Supabase cloud-hosted / Local Docker)
- **Styling:** Vanilla CSS (Bespoke Glassmorphic Dark Dashboard UI, mobile-responsive)
- **State Management:** TanStack React Query v5 (efficient caching and background refetching)
- **Deployment:** Vercel

---

## 🚀 Getting Started (Local Setup)

Follow these steps to run SpeedTrail locally with either a dockerized database or your own PostgreSQL instance.

### 1. Clone the Repository & Install Dependencies
```bash
git clone https://github.com/Viveksudrik/SpeedTrail.git
cd SpeedTrail
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root of the project. You can copy the template from `.env.example`:
```bash
cp .env.example .env
```

Ensure your `.env` contains:
```env
# For local Docker database setup
DATABASE_URL="postgresql://postgres:password@localhost:5432/speedtrail?schema=public"
DIRECT_URL="postgresql://postgres:password@localhost:5432/speedtrail?schema=public"
```

### 3. Spin Up the PostgreSQL Database
You have two options for running the database locally:

#### Option A: Using Docker Compose (Recommended)
Start the PostgreSQL container:
```bash
docker-compose up -d
```

#### Option B: Using the helper shell script
```bash
chmod +x start-database.sh
./start-database.sh
```

### 4. Push Database Schema & Generate Prisma Client
Apply the schema layouts to the database and generate local Prisma types:
```bash
npx prisma db push
```

### 5. Seed the Roommate Accounts & Default Memberships
Create default roommate credentials and their active group memberships (e.g. Meera's and Sam's timeline configurations):
```bash
node prisma/seed.js
```

### 6. Launch the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to access the app.

---

## 🤖 AI Collaboration & Tools Used

SpeedTrail was developed through an intensive, high-level collaboration between the Engineer and AI Agents.

### AI Systems Utilized
- **Gemini 3.5 Flash (Medium)** & **Claude 4.6 Thinking/Opus** via the **Antigravity Agent**.

### Work Division & Collaboration Flow
- **Engineer (Product Manager / Lead Architect):** Formulated architectural specifications, defined edge-case behaviors (temporal rules, currency handling), conducted regular code reviews, diagnosed performance and layout issues, and verified calculations against the spreadsheet.
- **AI Agent (Senior Developer Subagent):** Handled directory structure scaffolding, composed type-safe Prisma database schemas, wrote the CSV parsing and anomaly scanner logic, implemented client-side calculators (greedy balances, audit trails), and styled the responsive CSS interface.

### AI Course Corrections (Critical Engineering Interventions)
During development, the Engineer intervened to pivot and correct the AI's initial naive generations in 5 concrete cases:
1. **Interactive Import Wizard UI (Meera's Request):** The AI initially generated silent duplicate cleanup. The Engineer redirected it to persist anomalies in `ImportAnomaly` tables and build a wizard where the user approves merges/changes.
2. **Temporal Date Boundaries (Sam's Request):** The AI proposed simple static member tables. The Engineer corrected the schema to support `joinedAt`/`leftAt` bounds and update split-logic to filter out inactive roommates.
3. **Priya's Multi-Currency Conversions:** The AI assumed pure INR. The Engineer corrected this to store original `currency` and `exchangeRate` at the record level and run splits based on exchange rates.
4. **Stable Comparator Debt Minimization:** The AI proposed arbitrary sorting. The Engineer instructed it to port Spliit's stable comparator (sorting alphabetically by username in case of tie-breakers) to prevent settlement recommendation shifts.
5. **Bulk Transaction Timeout:** The AI configured a default 5-second Prisma transaction. During bulk import of the 40-row export, database timeouts occurred. The Engineer increased the transaction limit to 30,000ms.

For detailed breakdown, please see [AI_USAGE.md](./AI_USAGE.md).

---

## ⚡ Roommate Pain Points Resolved

| Roommate | Request | How SpeedTrail Solves It |
|---|---|---|
| **Aisha** | *"I just want one number per person. Who pays whom, how much, done."* | **Greedy Settlement Network:** Net balances are computed (`Paid - SplitOwed + Sent - Received`), sorted, and paired greedily (largest debtor to largest creditor) with a stable alphabetical comparator to minimize transaction counts. |
| **Rohan** | *"No magic numbers. Show me exactly which expenses make up my balance."* | **Chronological Ledger Audit Trail:** An itemized ledger page for each roommate. Summarizes all splits participated in, expenses paid, and settlements sent/received, with a running ledger balance that resolves perfectly to their net group balance. Supports CSV/JSON exports. |
| **Priya** | *"Half the trip was in dollars. The sheet pretends a dollar is a rupee."* | **Exchange Rate Tracking:** The DB stores currency code and exchange rate for every expense/settlement. Rates are configurable during CSV import, converting USD amounts to INR dynamically. |
| **Sam** | *"March electricity shouldn't affect my balance. I moved in mid-April."* | **Temporal Split Validation:** Member memberships are time-bounded (`joinedAt` and `leftAt`). The split engine checks if the expense date falls within the member's active period, automatically excluding inactive roommates or raising anomalies. |
| **Meera** | *"Clean up duplicates — but I want to approve deletes/changes."* | **Interactive Import Sessions:** Implements a multi-step import wizard. Discovered duplicates, incorrect names, missing currencies, and percentage sum mismatches are flagged in an anomaly resolution screen before committing. |

---

## 📊 CSV Ingestion & 18-Point Anomaly Detection

SpeedTrail parses and reconciles the messy `expenses_export.csv` file, scanning for 18 distinct anomaly types (surpassing the assignment minimum of 12). 

For the complete row-by-row mapping of all 16 anomalies in the spreadsheet, please refer to [SCOPE.md](./SCOPE.md). Key anomalies include:
- **Duplicate Rows & Conflicting Amounts** (e.g. Marina Bites dinner on Row 5/6, Thalassa dinner on Row 24/25)
- **Formatting Anomalies** (e.g. quoted amounts like `"1,200"` on Row 7, trailing whitespace on Row 27)
- **Name Casing & Payer Inconsistency** (e.g. mapping `priya` and `Priya S` to standard flatmate `Priya`)
- **Decimal Precision Rounding** (e.g. `899.995` on Row 10 rounded to `900.00`)
- **Missing Payer Fields** (Row 13 forces a dropdown choice)
- **Settlement Logged as Expense** (Row 14 and Row 38 converted to direct `Settlement` objects)
- **Invalid Splits** (Row 15 & 32 percentage splits sum to 110%, scaled back to 100% proportionally)
- **Invalid Names** (Row 23 Kabir's share assigned to Dev as guest split)
- **Temporal Split Boundaries** (Row 36 Meera's April split excluded)

---

## 🔐 Roommate Default Credentials

You can log in as any roommate using the login panel:
- **Aisha:** `aisha123`
- **Rohan:** `rohan123`
- **Priya:** `priya123`
- **Meera:** `meera123`
- **Sam:** `sam123`
- **Dev:** `dev123`

*💡 **Evaluator Convenience:** The login screen features a **"Quick Login"** grid of buttons. Click any roommate's name to log in instantly and toggle between their respective dashboards in a single click!*
