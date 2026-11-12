# Security Self-Assessment Checklist (Checklist bảo mật) – flow L8, v1.0

Checked by PHOUTTHAVONG Khanxay on 12/11/2026 on the code tagged `v1.0`, **by running the commands below** (screenshots in `docs/screenshots/bao-mat-*.png`).
Status values follow the BT3 brief: **ĐÃ LÀM** (done) · **CHƯA LÀM** (not done) · **KHÔNG ÁP DỤNG** (not applicable).
OWASP codes use the Top 10:2025 mapping of the course (`46_packaging_deployment_security.md` §4).

## Summary

| # | Item | OWASP 2025 | Status | One-line evidence |
|---|---|---|---|---|
| 1 | No secrets in the repository | A02 | **ĐÃ LÀM** | `git log --all --oneline -- .env` → empty; `git check-ignore -v .env` → `.gitignore:9:.env`; grep for hard-coded secrets in `src/` → empty (`bao-mat-1-2.png`) |
| 2 | Input validated at the application layer | A05 | **ĐÃ LÀM** | Validators before every service; 3 injection greps reviewed (only fixed SQL fragments / escaped HTML, 0 shell calls); `' OR 1=1 --` → 400; TC-08, TC-09 PASS |
| 3 | Owner-based access control | A01 | **ĐÃ LÀM** | Centre scope (QT-14) in services; per-survey access code in header `X-Survey-Code`; TC-10 PASS (BUG-006, BUG-010 fixed) |
| 4 | Passwords / sensitive data hashed or protected | A04 · A07 | **ĐÃ LÀM** | `password_hash` = `scrypt$<salt>$<hash>` (`bao-mat-4.png`); token payload without personal data (BUG-011); `AUTH_SECRET` ≥ 32 chars enforced |
| 5 | Error messages do not reveal internals | A10 · A02 | **ĐÃ LÀM** | Only `{error,message,field}`; database down → `/health` 503 `db: down`, API 500 generic (test); no `X-Powered-By` (BUG-009) (`bao-mat-5.png`) |
| 6 | Logs contain no secrets / unnecessary personal data | A09 | **ĐÃ LÀM** | No request logging; `grep -ciE "password\|token\|secret\|0[0-9]{9}" app.log` → `0` after logins, reports with phones, bad JSON (`bao-mat-6.png`) |
| 7 | Dependencies pinned + basic vulnerability check | A03 | **ĐÃ LÀM** | `package-lock.json` + `npm ci`; image `node:22.20-alpine`; `npm audit` and `npm audit --omit=dev` → `found 0 vulnerabilities` (`npm-audit.png`); CI audit step |

## Details and evidence

### 1. No secrets in the repository (A02) — ĐÃ LÀM
- `.env` has **never** been committed: `git log --all --oneline -- .env` prints nothing. `git check-ignore -v .env` → `.gitignore:9:.env`; `.dockerignore` also lists `.env`,
  so the secret is not copied into the image; `docker-compose.yml` reads it with `env_file`, no value is hard-coded.
- `grep -rniE "(password|secret|api_?key)\s*[:=]\s*['\"][^'\"]{6,}" src/` → no match (no hard-coded secret in the code).
- `.env.example` (committed) holds only placeholders: `AUTH_SECRET=khoa-ky-token-cho-moi-truong-hoc-tap-doi-lai-truoc-khi-dung-that` – its name says
  "change before real use"; Deployment Guide §3 and §7 give the command for a real 32-byte key. `DEMO_PASSWORD=Demo@2026` is the password of the 4 demo
  accounts of the sample data, intentionally public so the grader can log in (stored hashed, like every password).
- Test-only keys inside `tests/` (e.g. `authSecret: 'khoa-test-case-bt3'`) sign tokens for in-memory test databases only.
- The server refuses to start without `AUTH_SECRET` or with a key shorter than 32 characters, and the message never prints the key (`tests/health-startup.test.js`).

### 2. Input validated at the application layer (A05) — ĐÃ LÀM
- Every route calls a validator before the service: `routes/*.js` → `validators/{auth,survey,report,user}.validator.js`. Rules: positive integers, real
  calendar dates (`2026-02-30` rejected), enums, score integer 1–5, comment ≤ 500 chars, username pattern, password 8–72 chars with letters and digits,
  access code 32 hex chars. Invalid input → `400 DU_LIEU_KHONG_HOP_LE` **with the field name**; malformed JSON and bodies > 10 kB → 400, not 500.
- The 3 injection greps of `46a` §4 (output in `bao-mat-1-2.png`), each hit reviewed:
  - SQL built with `${…}` – **9 hits, all safe**: they insert only fixed SQL fragments written in the code (column list `PUBLIC_COLUMNS`, `WHERE` parts such as
    `'u.role = ?'`, `d.month`/`d.quarter` chosen by a fixed `if`, column names from a fixed map in `user.repository.update`, constant table names in
    `import-csv.js`); every user value is passed as a `?` parameter.
  - `innerHTML` – **7 hits, all safe**: every value coming from the API or the user is wrapped in `escapeHtml()` (`components/DataState.mjs`); the
    rest are fixed markup. Test "DataState: nội dung do máy chủ trả về được thoát ký tự (chống XSS)" PASS.
  - `exec(`/`spawn(`/shell – **0 hits** besides SQLite's `db.exec` of fixed SQL and a regex `.exec`; the app never runs OS commands.
- Live check: `GET /api/surveys?status=' OR 1=1 --` → `400 … "status phải là một trong: DA_GUI, DA_TRA_LOI"`; broken JSON → `400 "Nội dung gửi lên không phải JSON hợp lệ"`.
- Tests: `tests/validators.test.js` (boundary values 0/1/5/6, 500/501 chars), TC-08, TC-09. Database `CHECK`/`UNIQUE`/foreign keys are a second line of defence.

### 3. Owner-based access control (A01) — ĐÃ LÀM
- **Staff:** role check in `middleware/access.js` (`requireRole`) and **data scope in the services**: a centre manager only reads, reports on and deletes
  surveys of their own centre; another centre → 403. Marketing gets company-wide aggregates only (BS-05). Tests in `survey.api.test.js` (QT-14, QT-13).
- **Customers (no login):** each survey has a 128-bit random access code; it reaches the customer only inside the link
  `khao-sat.html?ticket=<id>#t=<code>` and is sent to the API in header `X-Survey-Code`. Missing code → 400, wrong code → 404, code in the URL → 400; the
  survey is not changed. This was a real **Critical** hole found by **TC-10** (BUG-006, fixed in `377c641`); the first fix still put the code in the URL
  query, corrected by **BUG-010** (`8c6d915`).
- Authentication (A07) by `tests/auth.service.test.js`: no token → 401; expired → 401; one character changed → 401 `TOKEN_KHONG_HOP_LE`; `alg=none` → 401;
  deactivated account → 401 on its next request. Token lifetime 1 h by default.

### 4. Passwords / sensitive data hashed or protected (A04 · A07) — ĐÃ LÀM
- `src/backend/utils/password.js`: scrypt, 16-byte random salt per password, 32-byte key, constant-time comparison; unknown usernames are checked
  against `DUMMY_HASH` so timing does not reveal accounts.
- Database content (`SELECT username, password_hash FROM app_user`, `bao-mat-4.png`): `bgd  scrypt$070149435fbd652a728f87e60b17e937$5dc7a5c7…` –
  every row a different salt, not readable. `password_hash` is never returned by the API (TC-05 asserts it).
- Token payload holds only `sub, role, center_id, iat, exp` – the staff name was removed (**BUG-011**, `a1c38ed`), because anyone holding a token can
  base64-decode it. Signing key ≥ 32 characters is enforced at start-up.
- Customer phone numbers are shown only to roles that must call customers back (QT-15); the public survey form returns no customer data.
- Not encrypted at rest: the SQLite file itself (see "Known gaps").

### 5. Error messages do not reveal internals (A10 · A02) — ĐÃ LÀM
- `src/backend/middleware/error-handler.js` is the only place that writes errors: known errors → `{error, message, field?}`; anything unexpected →
  `500 {"error":"LOI_HE_THONG","message":"Có lỗi hệ thống, vui lòng thử lại"}`.
- "Turn the database off and call the API" (course method): `tests/health-startup.test.js` closes the database under a running server →
  `/health` = `503 {"status":"error","db":"down"}`, `GET /api/surveys/1` = 500 generic message; the body contains no `sqlite`, table name, SQL or stack.
- `curl -si /api/khong-co` (`bao-mat-5.png`): body `{"error":"KHONG_TIM_THAY",…}`, headers without `X-Powered-By` (removed by **BUG-009**, `f474165`).
- CORS: no CORS headers are sent; UI and API share one origin, so browsers block other sites from reading the API with a user's credentials.
  (CORS is a browser rule, not server security – access control is item 3.)

### 6. Logs contain no secrets or unnecessary personal data (A09) — ĐÃ LÀM
- No request logger. `grep -rn "console\." src seeds` lists only: start-up message, migration/seed/import progress (table names, row counts), the
  `AUTH_SECRET` problem message (length only) and `console.error(err)` for **unexpected** 500 errors (server side only).
- Run (`bao-mat-6.png`): `npm start > app.log`, then successful and failed logins, a report, the low-score list (contains phone numbers), broken JSON →
  `grep -ciE "password|token|secret|0[0-9]{9}" app.log` → **0**. In Docker the same check is `docker compose logs app | grep -iE "password|token|0[0-9]{9}"`.
- Survey access codes are no longer in any URL (BUG-010), so they cannot end up in a server or proxy access log either.

### 7. Dependencies pinned and checked for known vulnerabilities (A03) — ĐÃ LÀM
- `package-lock.json` is committed; installs use `npm ci` (local, Dockerfile, CI). Runtime dependencies: `express`, `dotenv`, `chart.js`
  (+ `jsdom` for tests only, not in the runtime image: `npm ci --omit=dev`). Base image pinned `node:22.20-alpine`; CI uses Node `22.20.0`.
- `npm audit` on 07/11/2026 found `body-parser 2.0.0 - 2.3.0 · high` (GHSA-27r3-jxmh-p828) → **BUG-008**, fixed in `7ce09b2`.
  On 12/11/2026: `npm audit` → `found 0 vulnerabilities`; `npm audit --omit=dev` → `found 0 vulnerabilities` (`npm-audit.png`).
- `.github/workflows/ci.yml` runs `npm audit --audit-level=high` on every push.

## Known gaps (honest list – planned for CĐTN2)
| Gap | Risk | Mitigation idea |
|---|---|---|
| No rate limiting / lock-out on `POST /api/auth/login` | password guessing | `express-rate-limit` per IP + temporary lock after N failures |
| HTTP only (local Docker) | tokens readable on an untrusted network | TLS reverse proxy – steps in Deployment Guide §7 |
| No refresh token; a token cannot be revoked before expiry (except by deactivating the account) | a stolen token works up to `TOKEN_TTL_HOURS` (1 h) | refresh token in an `HttpOnly` cookie + server-side token version |
| No security headers (CSP, `X-Content-Type-Options`, …) | weaker browser-side protection | add `helmet` |
| SQLite file not encrypted at rest | someone with disk access reads customer phones | OS disk encryption / managed database with encryption |
| Survey access code has no expiry | an old link still opens the (already answered) survey | add `expires_at` to the code; QT-10 already blocks a second answer |
