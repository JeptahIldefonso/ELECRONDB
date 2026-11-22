# HOPE ERP — Automated Test Coverage & Task Mapping Matrix

This document maps all sprint testing deliverables and acceptance test cases from the Sprint Plan to their corresponding automated test implementations.

---

## 1. Sprint Testing Tasks Mapping (`S1-TST-01` to `S4-TST-06`)

| Task ID | Description | Automated? | Test File / Implementation |
| :--- | :--- | :---: | :--- |
| **S1-TST-01** | Sprint 1 Test Plan & Acceptance Criteria | **Yes** | `tests/COVERAGE.md`, `PULL_REQUEST.md` |
| **S1-TST-02** | Register, login, session, set/reset password rules | **Yes** | `tests/unit/validation.test.ts`, `tests/unit/auth-session.test.ts`, `e2e/auth-smoke.spec.ts` |
| **S1-TST-03** | User Management, safety guards, and last-superadmin protection | **Yes** | `tests/unit/permissions.test.ts` |
| **S1-TST-04** | Permission Matrix: 36 rights across all 6 modules (Superadmin/Admin/User) | **Yes** | `tests/unit/permissions.test.ts` |
| **S1-TST-05** | Automated smoke test: login and protected route redirects | **Yes** | `e2e/auth-smoke.spec.ts` |
| **S1-TST-06** | Bug reports and regression verification | **Yes** | `scripts/verify-db.mjs`, `tests/unit/` |
| **S2-TST-01** | Customer module test cases & validation constraints | **Manual/DB** | `scripts/verify-db.mjs` |
| **S2-TST-02** | Product & price history effective date tests | **Manual/DB** | `scripts/verify-db.mjs` |
| **S2-TST-03** | Soft-delete and child integrity checks (delete blocked by active children) | **Manual/DB** | `scripts/verify-db.mjs` |
| **S2-TST-04** | Per-right permission checks for Customer & Product (Add/Edit/Delete) | **Yes** | `tests/unit/permissions.test.ts` |
| **S2-TST-05** | Regression test of Sprint 1 foundation | **Yes** | `vitest run` suite |
| **S2-TST-06** | Bug reports & schema fix verification | **Yes** | `scripts/verify-db.mjs` |
| **S3-TST-01** | Department & Job CRUD verification | **Manual/DB** | `scripts/verify-db.mjs` |
| **S3-TST-02** | Employee CRUD & supervisor hierarchy | **Manual/DB** | `scripts/verify-db.mjs` |
| **S3-TST-03** | Job history chronological timeline & duplicate effective dates | **Manual/DB** | `scripts/verify-db.mjs` |
| **S3-TST-04** | Salary visibility & HR per-right permission tests (`view_job_history`) | **Yes** | `tests/unit/permissions.test.ts` |
| **S3-TST-05** | Regression test of Sprints 1-2 | **Yes** | `vitest run` suite |
| **S3-TST-06** | Bug reports & foreign key integrity checks | **Yes** | `scripts/verify-db.mjs` |
| **S4-TST-01** | Sales transactions & line item unit price auto-fill as of sales date | **Manual/DB** | `scripts/verify-db.mjs` |
| **S4-TST-02** | Payment balance calculation per transaction & customer | **Manual/DB** | `scripts/verify-db.mjs` |
| **S4-TST-03** | Reports suite: 7 canonical reports validation & export | **Manual/DB** | `scripts/verify-db.mjs` |
| **S4-TST-04** | End-to-end integration: register, verify, login, rights, sell, report | **Yes** | `e2e/auth-smoke.spec.ts` |
| **S4-TST-05** | Full system regression across all 10 canonical tables | **Yes** | `scripts/verify-db.mjs`, `vitest run` |
| **S4-TST-06** | Final test sign-off & acceptance summary | **Yes** | `tests/COVERAGE.md`, `PULL_REQUEST.md` |

---

## 2. Acceptance Test Cases Mapping (`T01` to `T10`)

| Case ID | Scenario | Automated? | Verification Method |
| :--- | :--- | :---: | :--- |
| **T01** | Non-team registration email flow | **Yes** | `tests/unit/validation.test.ts` |
| **T02** | Link verification & session establishment | **Yes** | `tests/unit/auth-session.test.ts` |
| **T03** | Duplicate registration rejection | **Yes** | `tests/unit/validation.test.ts` |
| **T04** | Unconfirmed login blocked (HTTP 403) | **Yes** | `tests/unit/validation.test.ts` |
| **T05** | Resend cooldown enforcement (60s rate limit) | **Manual/Unit** | Verified via API endpoint route handler |
| **T06** | Self-Service Password Reset (token request -> change) | **Yes** | `tests/unit/auth-session.test.ts` |
| **T07** | Admin Reset Password link generation | **Manual** | Verified via Gmail SMTP & recovery endpoint |
| **T08** | Username-only admin login mapping | **Yes** | `tests/unit/permissions.test.ts` |
| **T09** | User Management sync with `app_users` | **Yes** | `scripts/verify-db.mjs` |
| **T10** | Route Protection Guard & Unauthenticated Redirects | **Yes** | `e2e/auth-smoke.spec.ts` |

---

## 3. Test Execution Commands

```bash
# Run all unit and integration tests
npm test

# Run tests in watch mode
npm run test:watch

# Run Playwright end-to-end tests
npm run test:e2e

# Run canonical database verification
npm run db:verify
```
