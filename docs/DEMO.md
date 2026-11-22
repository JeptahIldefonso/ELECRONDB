# Hope, Inc. ERP — Professor Demo Guide & Operational Playbook

> **Purpose:** Step-by-step walkthrough and operational reference for presenting the Hope, Inc. ERP Monitoring & Management System. Designed for zero-error execution on the live Vercel deployment, with full Supabase persistence.

---

## 1. Demo Credentials

Seeded demo accounts with demo-only credentials for presentation:

| Role | Email | Password | Access Level & Scope |
| :--- | :--- | :--- | :--- |
| **Superadmin** | `superadmin@hope.com` | `useradmin` | Universal access across all modules, rights matrix, and user administration. |
| **Admin** | `admin1@gmail.com` | `useradmin` | Full operational control across Customer, Sales, Products, HR, and Reports. |
| **Admin (Backup)**| `admin2@gmail.com` | `useradmin` | Secondary administrator account. |
| **Standard User** | `user1@gmail.com` | `useruser` | Operational staff view (Customer, Products, Sales, standard Reports). User management hidden. |

---

## 2. Pre-Demo Checklist (5 Minutes Before Presentation)

1. **Verify Database Status Pill:**
   - Open [https://elecrondb.vercel.app](https://elecrondb.vercel.app) in your browser.
   - Confirm the status pill in the header displays **Active** with a green indicator.
2. **Run Parity Gate Check:**
   - In terminal: `npm run db:verify` or `npm run demo:reset`
   - Confirm row counts display **928 canonical records** across all 10 tables.
3. **Export Pre-Demo Backup:**
   - In terminal: `npm run demo:backup`
   - Creates a timestamped snapshot in `backups/backup-<timestamp>.json`.
4. **Keep-Alive Verification:**
   - Open [https://elecrondb.vercel.app/api/keepalive](https://elecrondb.vercel.app/api/keepalive)
   - Expected response: `{"ok":true,"engine":"postgres",...}`.

---

## 3. How to Restore a Paused Supabase Project

If the free Supabase project was idle for over 7 days and paused:
1. Log in to [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Select the project: **tkooiwalyqvumdwxnriv** (or your current project).
3. Click the yellow/amber **Restore Project** banner at the top of the dashboard.
4. Wait 60–90 seconds while the database resumes.
5. Hit [https://elecrondb.vercel.app/api/keepalive](https://elecrondb.vercel.app/api/keepalive) to confirm connectivity.

> **Note:** The automated daily Vercel cron job configured in `vercel.json` calls `/api/keepalive` daily to prevent inactivity pausing automatically.

---

## 4. Step-by-Step Presentation Walkthrough

### Part A: System Architecture & Data Model (2 mins)
1. **Navigate to Data Model:** Click **Data Model** (`/data-model`) in the navigation.
2. **Point out to Professor:**
   - 10 Relational Tables meeting third normal form (3NF).
   - 9 Primary-Foreign Key relationships.
   - Historical tracking for Employee Job History and Product Price History.
   - Parity counter displaying 928 canonical rows.

### Part B: Superadmin & User Management (3 mins)
1. **Login as Superadmin:**
   - Sign in with `superadmin@hope.com` / `useradmin`.
2. **User Management (`/users`):**
   - Click **User Management** in the sidebar.
   - Show the list of system users, their active statuses, and assigned roles.
3. **Create a New Staff Account:**
   - Click **Add User**.
   - First Name: `Alex`, Last Name: `Rivera`
   - Email: `alex.rivera@demo.com`
   - Role: `User (Standard Staff)`
   - Password: `userdemo123`
   - Click **Add User** -> Verify account immediately appears in the table.
4. **Role & Rights Granularity:**
   - Click **Rights** on `alex.rivera@demo.com`.
   - Toggle specific permissions (e.g. grant/revoke *Edit Customer* or *Add Sale*).
   - Click **Save Rights** -> Confirmation banner appears.
5. **Block / Unblock Demo:**
   - Click **Block** -> Status changes to *Blocked*.
   - Click **Unblock** -> Status returns to *Active*.

### Part C: Customer Management Module (3 mins)
1. **Navigate to Customer (`/customers`):**
   - Show 82 canonical enterprise customer records.
2. **Add Customer:**
   - Click **New Customer**.
   - Customer No: `C9999`
   - Name: `Demo Enterprises Inc.`
   - Address: `123 Ayala Ave, Makati City`
   - Payment Terms: `30D`
   - Click **Save Customer** -> Confirms addition and revalidates table.
3. **Edit Customer:**
   - Search for `C9999` using the live search bar.
   - Click **Edit** -> Change address to `Suite 500, BGC, Taguig City`.
   - Save -> Verify instant update.

### Part D: Sales & Transaction Processing (3 mins)
1. **Navigate to Sales (`/sales`):**
   - Show 124 sales headers and transaction monitoring.
2. **View Transaction Details:**
   - Click any transaction (e.g. `TR-0001` or top sales entry).
   - Show line items, unit pricing, extended totals, and customer linkage.
3. **Payments:**
   - Navigate to **Payments** / Collections monitoring.
   - Show official receipt (OR) allocations linked back to specific sales transactions.

### Part E: Catalog & Human Resources (2 mins)
1. **Products (`/products`):**
   - Show 57 active product items with current price tags.
   - Show Price History modal illustrating effective date price tracking (`PRICEHIST`).
2. **Human Resources (`/employees`):**
   - Show 32 staff records with departmental assignments.
   - Open Job History for an employee to show historical promotions and salary adjustments (`JOBHISTORY`).

### Part F: Executive Reports & Analytical Views (2 mins)
1. **Navigate to Reports (`/reports`):**
   - **Top 5 Customers by Revenue:** Demonstrates aggregated SQL `SUM(amount)` grouping.
   - **Product Master List:** Filterable catalog overview with stock pricing.
   - **Active vs. Separated Employees:** Filter by departmental hierarchy.
   - **Top Sales Transactions:** High-value order analytics.

---

## 5. Instant Demo Reset (One Command)

If you modify or create test data during practice or before the professor's review:

```bash
npm run demo:reset
```

**What it does:**
- Truncates/re-seeds the 10 ERD tables back to the canonical **928 rows**.
- Re-seeds the 4 demo accounts (`superadmin@hope.com`, `admin1@gmail.com`, `admin2@gmail.com`, `user1@gmail.com`).
- Re-establishes the 36 canonical system rights.
- Prints confirmation row counts.

---

## 6. One-Command Backup Export

To take an instant full snapshot of the database state at any time:

```bash
npm run demo:backup
```

Saved to: `backups/backup-<timestamp>.json` with complete table-by-table row records.

---

## 7. Emergency Local Fallback Instructions

If internet connectivity or university Wi-Fi drops during the demo:

1. **Ensure Local Environment:**
   ```bash
   cd ELECRONDB
   npm run build
   npm start
   ```
2. **Open Browser:**
   Navigate to [http://localhost:3000](http://localhost:3000).
   The local fallback runs identically with SQLite `hope.work.db` or PostgreSQL, complete with all demo accounts and canonical data.
