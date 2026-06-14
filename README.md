# SpeedTrail - Shared Flatmate Expenses App

SpeedTrail is a modern, high-fidelity shared expenses management web application built for flatmates (Aisha, Rohan, Priya, Meera, Sam, and Dev). It features time-bound group membership tracking, multi-currency support, a greedy debt simplification engine, individual running-balance audit trails, and an interactive CSV ingestion wizard for handling messy datasets.

*   **Public Deployed URL:** [https://speedtrail.vercel.app/](https://speedtrail.vercel.app/)
*   **AI Usage Documentation:** See [AI_USAGE.md](./AI_USAGE.md) for detailed descriptions of AI tools and course corrections.
*   **Decision Log:** See [DECISIONS.md](./DECISIONS.md) for architectural tradeoffs and design rationale.
*   **Schema & Anomaly Log:** See [SCOPE.md](./SCOPE.md) for database schema and the 16-anomaly resolution log.

---

## 🛠 Tech Stack
*   **Framework:** Next.js 15 (App Router)
*   **Language:** TypeScript
*   **API Protocol:** tRPC (E2E Type-Safety)
*   **Database ORM:** Prisma ORM
*   **Database Engine:** PostgreSQL (Supabase cloud-hosted)
*   **Styling:** Vanilla CSS (Modern dark glassmorphic UI)
*   **Deployment:** Vercel

---

## 🚀 Getting Started

### 1. Clone and Install Dependencies
```bash
git clone https://github.com/<your-username>/SpeedTrail.git
cd SpeedTrail
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory and configure your PostgreSQL connection parameters:
```env
DATABASE_URL="postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres"
```

### 3. Push Database Schema & Generate Prisma Client
Push the database model layout directly to the database:
```bash
npx prisma db push
```

### 4. Seed Database Accounts
Create the flatmates' login credentials and default group memberships:
```bash
npx prisma db seed
```

### 5. Launch Development Server
Boot up the Next.js development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to interact with the application.

---

## ☁️ Deploying to Vercel

1. Push the repository to GitHub.
2. Import the repository in [Vercel Dashboard](https://vercel.com/new).
3. Set the following **Environment Variables** in Vercel project settings:
   *   `DATABASE_URL` — Your Supabase pooler connection string (port `6543` with `?pgbouncer=true`).
   *   `DIRECT_URL` — Your Supabase direct connection string (port `5432`).
4. Vercel will automatically detect Next.js and run `npx prisma generate && next build`.
5. Ensure your Supabase database has been seeded (`npx prisma db seed`) before first use.

---

## 🔐 Roommate Default Credentials
You can log in as any roommate using the login panel.
*   **Aisha:** password `aisha123`
*   **Rohan:** password `rohan123`
*   **Priya:** password `priya123`
*   **Meera:** password `meera123`
*   **Sam:** password `sam123`
*   **Dev:** password `dev123`

*Evaluator Note: For convenience, a "Quick Login" button grid is provided on the sign-in screen to toggle between flatmate dashboards in a single click.*
