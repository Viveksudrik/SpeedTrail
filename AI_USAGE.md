# AI Usage Log

This document outlines the collaboration between the Engineer and the AI Assistants (Gemini 3.5 Flash & Claude 4.6 Thinking/Opus via the Antigravity agent) in designing and implementing the Shared Expenses App.

## 1. AI Tools Used
*   **Primary AI Assistant:** Gemini 3.5 Flash (Medium) & Claude 4.6 Thinking/Opus via the Antigravity Agent.
*   **Roles:** 
    *   **AI:** Acted as a senior technical developer, proposing architecture, scanning raw inputs, writing the parser, porting codebase patterns, and building components.
    *   **Engineer (User):** Acted as the Product Manager and Lead Engineer, inspecting all generated code, defining the edge case resolutions, defining the temporal membership constraints, validating the calculations, and configuring production deployments.

---

## 2. Key Prompts and Flow
1.  **Initial Discovery:** Analyzing `Expenses Export.csv` to map all data anomalies and reconcile roommate requests (Aisha, Rohan, Priya, Sam, Meera).
2.  **Architecture Design:** Designing a unified Next.js + PostgreSQL structure to ensure a production-ready, scalable relational database configuration.
3.  **Refinement:** Iterating on the import wizard UI to ensure Meera has manual approval over database commits, and validating balance minimization formulas.
4.  **Spliit Codebase Study:** Conducting a comprehensive comparative codebase analysis of "Spliit" (open-source alternative) to study and port high-value patterns (stable comparator, search, export).

---

## 3. Concrete Cases of AI Course Corrections

The Engineer intervened in the following five concrete instances to correct the AI's initial naive code generation and ensure a robust final product:

### Case 1: Silent Duplicate & Anomaly Merging (Meera's Request)
*   **AI's Initial Approach:** The AI suggested using standard Javascript routines to automatically clean up duplicates (like the two Marina Bites rows) by keeping the first entry and dropping the second silently.
*   **Engineer's Intervention:** The Engineer pointed out that Meera specifically requested: *"I want to approve anything the app deletes or changes."* Silent deletion would fail this requirement.
*   **Correction:** The Engineer directed the AI to build a temporary `ImportAnomaly` table and create a step-by-step **Interactive Import Wizard UI**. In this wizard, duplicates are surfaced side-by-side, allowing the user to explicitly select the merge target or keep both before committing to the DB.

### Case 2: Ignoring Temporal Membership (Sam's Request)
*   **AI's Initial Approach:** The AI proposed a simple `GroupMember` mapping table without any date bounds, splitting all expenses equally among all group members.
*   **Engineer's Intervention:** The Engineer highlighted Sam's request: *"I moved in mid-April. Why would March electricity affect my balance?"* and Meera's departure at the end of March.
*   **Correction:** The database schema was refactored to include `joined_at` and `left_at` timestamps in the `group_memberships` relation. The backend split-logic was updated to filter out members whose active duration does not cover the expense date, flagging Meera's April transactions as temporal anomalies for user resolution.

### Case 3: Flat Currency Assumption (Priya's Request)
*   **AI's Initial Approach:** The AI designed the transaction table with a simple float `amount` field, assuming all operations occurred in INR.
*   **Engineer's Intervention:** The Engineer pointed out Priya's request: *"Half the trip was in dollars. The sheet pretends a dollar is a rupee. That can’t be right."*
*   **Correction:** The database schema was updated to store the original `currency` and a record-specific `exchange_rate`. The calculation engine was revised to store the base amounts in their original currency, but compute balances and settlements in INR using the historical trip rate (1 USD = 95 INR by default, customizable during CSV import).

### Case 4: Spliit Codebase Comparison Study
*   **AI's Initial Approach:** The AI initially recommended porting receipt scanning (via GPT-4V) and recurring lazy-materialized expenses.
*   **Engineer's Intervention:** The Engineer noted that the core requirements demand E2E ledger search, data portability (export), and stable balance computation without adding high-risk external API dependencies or complex cron workflows.
*   **Correction:** The AI analyzed the Spliit codebase and extracted a pure JS stable sorting tiebreaker comparator for simplified roommate debts and client-side Blob-based data exports, keeping the application self-contained.

### Case 5: Bulk Database Transaction Timeout
*   **AI's Initial Approach:** The AI configured Prisma transactions to commit all CSV rows under standard default database transaction timeouts (usually 5 seconds).
*   **Engineer's Intervention:** During E2E testing of the full 40-row spreadsheet ingestion, the transaction timed out due to the large volume of complex split and anomaly creations.
*   **Correction:** The AI modified the Prisma transaction execution block to specify an explicit timeout of 30,000ms (`{ timeout: 30000 }`), which resolved the blocker and allowed seamless bulk imports.
