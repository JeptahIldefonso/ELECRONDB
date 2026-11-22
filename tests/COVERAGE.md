# HOPE ERP — Automated Test Coverage & Task Mapping Matrix

This document maps all sprint testing deliverables and acceptance test cases from the Sprint Plan to their status: **Automated**, **Manual-only**, or **Not covered yet**, specifying the exact test file where automated.

---

## 1. Sprint Testing Tasks Mapping (`S1-TST-01` to `S4-TST-06`)

| Task ID | Description | Status | Test File / Verification Method |
| :--- | :--- | :---: | :--- |
| **S1-TST-01** | Sprint 1 Test Plan & Acceptance Criteria | **Manual-only** | Documented in `tests/COVERAGE.md` and Sprint Plan |
| **S1-TST-02** | Register, login, session, set/reset password rules, rights audit | **Automated** | `tests/unit/validation.test.ts`, `tests/unit/auth-session.test.ts`, `tests/unit/rights-diff.test.ts` |
| **S1-TST-03** | User Management, safety guards, and last-superadmin protection | **Not covered yet** | Rights checked in `tests/unit/permissions.test.ts`; last-superadmin guard test planned for Stage 6 |
| **S1-TST-04** | Permission Matrix: 36 rights across all 6 modules (Superadmin/Admin/User) | **Automated** | `tests/unit/permissions.test.ts` |
| **S1-TST-05** | Automated smoke test: login and protected route redirects | **Automated** | `e2e/auth-smoke.spec.ts` |
| **S1-TST-06** | Bug reports and regression verification | **Manual-only** | Verified manually via GitHub Issues tracking |
| **S2-TST-01** | Customer module test cases & validation constraints | **Manual-only** | Form boundary validation verified manually in UI |
| **S2-TST-02** | Product & price history effective date tests | **Manual-only** | Effective date chronology verified manually in UI/DB |
| **S2-TST-03** | Soft-delete and child integrity checks (delete blocked by active children) | **Not covered yet** | Schema trigger checks planned for Stage 4 |
| **S2-TST-04** | Per-right permission checks for Customer & Product (Add/Edit/Delete) | **Automated** | `tests/unit/permissions.test.ts` |
| **S2-TST-05** | Regression test of Sprint 1 foundation | **Automated** | `tests/unit/permissions.test.ts`, `tests/unit/auth-session.test.ts` |
| **S2-TST-06** | Bug reports & schema fix verification | **Manual-only** | Verified manually against database schema |
| **S3-TST-01** | Department & Job CRUD verification | **Manual-only** | Tested manually via HR module UI |
| **S3-TST-02** | Employee CRUD & supervisor hierarchy | **Manual-only** | Tested manually via Employee profile & reporting tree |
| **S3-TST-03** | Job history chronological timeline & duplicate effective dates | **Manual-only** | Tested manually via Job History UI |
| **S3-TST-04** | Salary visibility & HR per-right permission tests (`view_job_history`) | **Automated** | `tests/unit/permissions.test.ts` |
| **S3-TST-05** | Regression test of Sprints 1-2 | **Automated** | `tests/unit/permissions.test.ts` |
| **S3-TST-06** | Bug reports & foreign key integrity checks | **Manual-only** | Foreign key relations verified manually in DB |
| **S4-TST-01** | Sales transactions & line item unit price auto-fill as of sales date | **Manual-only** | Tested manually via POS transaction UI |
| **S4-TST-02** | Payment balance calculation per transaction & customer | **Manual-only** | Balance rollups verified manually in Sales & Payments UI |
| **S4-TST-03** | Reports suite: 7 canonical reports validation & export | **Manual-only** | Tested manually across all 7 reports and CSV export |
| **S4-TST-04** | End-to-end integration: register, verify, login, rights, sell, report | **Not covered yet** | Full cross-module flow requires Stages 2–6 migrations |
| **S4-TST-05** | Full system regression across all 10 canonical tables | **Manual-only** | Database schema verification via `scripts/verify-db.mjs` |
| **S4-TST-06** | Final test sign-off & acceptance summary | **Manual-only** | Documented in Sprint Acceptance Review |
| **S4-DEV-08** | Dedicated Audit Log Viewer for Superadmin | **Automated** | `src/app/(dashboard)/audit/page.tsx`, `tests/unit/audit-filters.test.ts`, `e2e/auth-smoke.spec.ts` |
| **S4-DBA-04** | Audit Log query performance indexes & sanitization | **Automated** | `database/migrations/24_audit_log_indexes.sql`, `tests/unit/audit-filters.test.ts` |
| **S4-UIX-03** | Audit Log Viewer UI: filters, table, and diff modal | **Automated** | `src/components/audit/AuditView.tsx` |
| **S3-DBA-03** | Link `app_users.empno` to EMPLOYEE: FK, unique index, validation & UI | **Automated** | `database/migrations/25_link_app_users_empno.sql`, `database/migrations/26_audit_trigger_empno.sql`, `tests/unit/empno-linking.test.ts`, `scripts/verify-stage4.mjs` |

---

## 2. Acceptance Test Cases Mapping (`T01` to `T10`)

| Case ID | Scenario | Status | Verification Method |
| :--- | :--- | :---: | :--- |
| **T01** | Non-team registration email flow (verification email arrives) | **Manual-only** | Live Gmail SMTP delivery verified in real inbox |
| **T02** | Link verification & session establishment | **Manual-only** | Click email token link -> Supabase auth callback verified in browser |
| **T03** | Duplicate registration rejection | **Not covered yet** | Tested manually; automated integration test planned after Stage 2 |
| **T04** | Unconfirmed login blocked (HTTP 403) | **Manual-only** | Supabase Auth unconfirmed email response verified manually |
| **T05** | Resend cooldown enforcement (60s rate limit) | **Manual-only** | UI countdown timer & endpoint cooldown verified manually |
| **T06** | Self-Service Password Reset (token request -> change) | **Not covered yet** | Flow implemented in Stage 5; HMAC session signing automated in `tests/unit/auth-session.test.ts` |
| **T07** | Admin Reset Password link generation | **Manual-only** | Superadmin password recovery action verified via email |
| **T08** | Username-only admin login mapping | **Manual-only** | Username-to-email synthetic mapping verified manually |
| **T09** | User Management sync with `app_users` | **Manual-only** | Verified via Superadmin dashboard and DB triggers |
| **T10** | Route Protection Guard & Unauthenticated Redirects | **Automated** | `e2e/auth-smoke.spec.ts` |

---

## 3. Test Execution Commands

```bash
# Run all unit and integration tests (Vitest with production DB guard)
npm test

# Run tests in watch mode
npm run test:watch

# Run Playwright end-to-end tests (starts local server automatically)
npm run test:e2e

# Run canonical database verification script
npm run db:verify
```
