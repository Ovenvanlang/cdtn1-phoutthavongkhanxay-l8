# Security Self-Assessment Checklist (Checklist bảo mật) – flow L8, v1.0

Checked by PHOUTTHAVONG Khanxay on 07/11/2026 on the code at tag `v1.0`. Status values follow the BT3 brief:
**ĐÃ LÀM** (done) · **CHƯA LÀM** (not done) · **KHÔNG ÁP DỤNG** (not applicable). Every "ĐÃ LÀM" has evidence you can re-run.
OWASP references use the OWASP Top 10:2025 numbering of the course material (`69a_testing_se.md` §4).

## Summary

| # | Item | Status | One-line evidence |
|---|---|---|---|
| 1 | No secrets in the repository | **ĐÃ LÀM** | `git log --all --oneline -- .env` → empty; `.gitignore` and `.dockerignore` contain `.env`; only `.env.example` with a learning-only placeholder is committed |
| 2 | Input validated at the application layer | **ĐÃ LÀM** | `src/backend/validators/*.js` run before every service; TC-08, TC-09 PASS; SQL always parameterised |
| 3 | Owner-based access control | **ĐÃ LÀM** | Centre scope (QT-14) in services + per-survey access code for customers (BUG-006 fixed); TC-10 PASS |
| 4 | Passwords / sensitive data hashed or protected | **ĐÃ LÀM** | `app_user.password_hash` = `scrypt$<salt>$<hash>` (query below); never returned by the API |
| 5 | Error messages do not reveal internals | **ĐÃ LÀM** | `middleware/error-handler.js` returns `{error,message,field}` only; 500 → generic text; `X-Powered-By` removed (BUG-009) |
| 6 | Logs contain no secrets / unnecessary personal data | **ĐÃ LÀM** | No request logging; only start-up lines and unexpected 500 errors are logged (`grep -rn "console\." src seeds`) |
| 7 | Dependencies pinned + basic vulnerability check | **ĐÃ LÀM** | `package-lock.json` + `npm ci`; base image `node:22.20-alpine`; `npm audit` → `found 0 vulnerabilities` after BUG-008; CI runs `npm audit --audit-level=high` |

## Details and evidence

### 1. No secrets in the repository — ĐÃ LÀM
- `.env` has **never** been committed: `git log --all --oneline -- .env` prints nothing.
- `.gitignore` line `.env`; `.dockerignore` line `.env` (the secret is not copied into the image either); `docker-compose.yml` reads it with `env_file`, no value is hard-coded.
- `.env.example` (committed) contains `AUTH_SECRET=khoa-ky-token-cho-moi-truong-hoc-tap-doi-lai-truoc-khi-dung-that` – a **placeholder whose name says "change before real use"**; the Deployment Guide §3 gives the command to generate a real 32-byte key. `DEMO_PASSWORD=Demo@2026` is the password of the 4 demo accounts of the sample data, intentionally public so the grader can log in.
- History scan: `git log --all -p | grep -iE "^\+.*(AUTH_SECRET|secret|api[_-]?key)\s*[=:]"` only finds the placeholder above and test-only values inside `tests/` (e.g. `authSecret: 'khoa-test-case-bt3'`), which sign tokens in in-memory test databases.
- The server refuses to start without `AUTH_SECRET` (`src/backend/server.js`), so there is no built-in default key.

### 2. Input validated at the application layer — ĐÃ LÀM
- Every route calls a validator before the service: `routes/*.js` → `validators/{auth,survey,report,user}.validator.js`. Rules: positive integers, real calendar dates (`2026-02-30` rejected), enums, score integer 1–5, comment ≤ 500 chars, username pattern, password 8–72 chars with letters and digits, access code 32 hex chars.
- Invalid input → `400 DU_LIEU_KHONG_HOP_LE` **with the field name**; malformed JSON and bodies > 10 kB → 400, not 500.
- Tests: `tests/validators.test.js` (boundary values 0/1/5/6, 500/501 chars), TC-08 (missing score → 400 `field: score`, survey unchanged), TC-09 (broken JSON → 400, no account created).
- Second line of defence in the database: `CHECK` constraints on score/status, `UNIQUE(ticket_id)`, foreign keys (test "NFR4: CSDL tự chặn…").
- Injection (A05): all SQL uses prepared statements with `?` parameters (`repositories/*.js`; filters are fixed SQL fragments). The UI inserts data with `escapeHtml` (`components/DataState.mjs`), so a comment such as `<script>…` is shown as text.

### 3. Owner-based access control (A01) — ĐÃ LÀM
- **Staff:** role check in `middleware/access.js` (`requireRole`), and **data scope in the services**: a centre manager only reads, reports on and deletes surveys of their own centre (`survey.service.list/remove`, `report.service.resolveCenter`); asking for another centre → 403. Marketing only gets company-wide aggregates (BS-05). Tests: `survey.api.test.js` "QT-14: quản lý chỉ thấy trung tâm mình…", "QT-13: … quản lý trung tâm khác không xóa được".
- **Customers (no login):** each survey has a 128-bit random access code; the link `khao-sat.html?ticket=<id>&t=<code>` is the only way to read or answer it; wrong/missing code → 404/400 and the survey is not changed. This was a real **Critical** hole found by **TC-10** (BUG-006, fixed in commit `377c641`).
- Manual check (A01, 5 minutes): `curl -s -X POST http://localhost:3000/api/surveys/1 -H "Content-Type: application/json" -d '{"score":1}'` → `400 … "field":"t"`; with `?t=00000000000000000000000000000000` → `404 KHONG_TIM_THAY`.
- Authentication (A07) checked by hand and by `tests/auth.service.test.js`: no token → 401 `CHUA_DANG_NHAP`; expired token → 401; token with one character changed → 401 `TOKEN_KHONG_HOP_LE`; `alg=none` token → 401; deactivated account → 401 on its next request.

### 4. Passwords / sensitive data hashed — ĐÃ LÀM
- `src/backend/utils/password.js`: scrypt (Node `crypto.scryptSync`), 16-byte random salt per password, 32-byte key, constant-time comparison; unknown usernames are hashed against `DUMMY_HASH` so timing does not reveal accounts.
- Real database content (fresh `npm run db:setup`, query `SELECT username, password_hash FROM app_user`):
  ```
  hethong     scrypt$cd7087354dfc168c6e1576ceefb17e4f$bc3a9df5741aedc08b34…  (104 chars)
  bgd         scrypt$0d4e6a0f3d80f52f5e263eb424e165ab$dfa300d965b0b599dd70…  (104 chars)
  ```
  Same password, different hashes (different salts) – not readable.
- `password_hash` is excluded from every API response (TC-05 asserts it); survey access codes are only returned to the system actor in `survey_link`.
- Customer phone numbers are shown only to roles that must call customers back (QT-15); the public survey form returns no customer data.
- Not encrypted at rest: the SQLite file itself (see "Known gaps").

### 5. Error messages do not reveal internals (A02) — ĐÃ LÀM
- `src/backend/middleware/error-handler.js` is the only place that writes errors: known business errors → `{error, message, field?}`; anything unexpected → `500 {"error":"LOI_HE_THONG","message":"Có lỗi hệ thống, vui lòng thử lại"}` – no stack trace, SQL, table name or file path.
- Checked by reading the **full** response with `curl -i` on 400, 401, 404 and malformed JSON (`{"error":"DU_LIEU_KHONG_HOP_LE","message":"Nội dung gửi lên không phải JSON hợp lệ"}`).
- That check found header `X-Powered-By: Express` on every response → **BUG-009** (Minor), fixed in `f474165` with `app.disable('x-powered-by')`; test "BUG-009: … X-Powered-By" PASS.
- CORS (A02): no CORS headers are sent; UI and API share one origin, so browsers block other sites from reading the API.

### 6. Logs contain no secrets or unnecessary personal data — ĐÃ LÀM
- The server has no request logger. `grep -rn "console\." src seeds` lists only: start-up message, migration/seed/import progress (table names and row counts), the missing-`AUTH_SECRET` message, and `console.error(err)` for **unexpected** 500 errors.
- Nothing logs request bodies, headers, tokens, passwords, access codes or phone numbers; the seed says "password taken from DEMO_PASSWORD" without printing it.
- The 500 log contains the error stack for the developer, server-side only (container log), never in the HTTP response.

### 7. Dependencies pinned and checked for known vulnerabilities (A03) — ĐÃ LÀM
- `package-lock.json` is committed; installs use `npm ci` (local, Dockerfile, CI) so every machine gets the same versions. Runtime dependencies: `express`, `dotenv`, `chart.js` (+ `jsdom` for tests only, not in the image: `npm ci --omit=dev`).
- Docker base image pinned to `node:22.20-alpine` in both stages; CI uses Node `22.20.0`.
- `npm audit` on 07/11/2026 reported `body-parser 2.0.0 - 2.3.0 · Severity: high` (GHSA-27r3-jxmh-p828) → **BUG-008** (Critical), fixed in `7ce09b2` (`body-parser` 2.4.0). Now: `npm audit` → `found 0 vulnerabilities`.
- `.github/workflows/ci.yml` runs `npm audit --audit-level=high` on every push, so a new high/critical advisory turns the build red.

## Known gaps (honest list – not required by the 7 items, planned for CĐTN2)
| Gap | Risk | Mitigation idea |
|---|---|---|
| No rate limiting / lock-out on `POST /api/auth/login` | password guessing | `express-rate-limit` per IP + temporary lock after N failures |
| HTTP only (local Docker) | tokens readable on an untrusted network | run behind a TLS reverse proxy (Caddy/Nginx) when deployed |
| Tokens cannot be revoked before expiry (except by deactivating the account) | a stolen token works up to `TOKEN_TTL_HOURS` | shorter TTL + server-side token version per user |
| No security headers (CSP, `X-Content-Type-Options`, …) | weaker browser-side protection | add `helmet` |
| SQLite file not encrypted at rest | someone with disk access reads customer phones | OS disk encryption / managed database with encryption |
