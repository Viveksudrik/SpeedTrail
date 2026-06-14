# SpeedTrail - Shared Flatmate Expenses App

SpeedTrail is a modern, high-fidelity shared expenses management web application built for flatmates (Aisha, Rohan, Priya, Meera, Sam, and Dev). It features time-bound group membership tracking, multi-currency support, a greedy debt simplification engine, individual running-balance audit trails, and an interactive CSV ingestion wizard for handling messy datasets.

*   **Public Deployed URL:** [https://speedtrail.vercel.app/](https://speedtrail.vercel.app/) *(Placeholder)*
*   **AI Usage Documentation:** See [AI_USAGE.md](file:///Users/viveksudrik/repos/SpeedTrail/AI_USAGE.md) for detailed descriptions of AI tools and course corrections.

---

## 🛠 Tech Stack
*   **Framework:** Next.js 15 (App Router)
*   **Language:** TypeScript
*   **API Protocol:** tRPC (E2E Type-Safety)
*   **Database ORM:** Prisma ORM
*   **Database Engine:** PostgreSQL (Supabase cloud-hosted)
*   **Styling:** Vanilla CSS (Modern dark glassmorphic UI)

---

## 🚀 Getting Started

### 1. Clone and Install Dependencies
Ensure you are in the repository directory, then run:
```bash
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

## 🔐 Roommate Default Credentials
You can log in as any roommate using the login panel.
*   **Aisha:** password `aisha123`
*   **Rohan:** password `rohan123`
*   **Priya:** password `priya123`
*   **Meera:** password `meera123`
*   **Sam:** password `sam123`
*   **Dev:** password `dev123`

*Evaluator Note: For convenience, a "Quick Login" button grid is provided on the sign-in screen to toggle between flatmate dashboards in a single click.*
