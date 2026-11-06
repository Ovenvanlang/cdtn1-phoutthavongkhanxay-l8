# Deployment Guide – CSAT Survey System (flow L8, Smart CRM Mekong Mobile)

Version 1.0 (tag `v1.0`) · Author: PHOUTTHAVONG Khanxay (237480201IS10) · Repository: https://github.com/Ovenvanlang/cdtn1-phoutthavongkhanxay-l8

The system is one container: an Express 5 API that also serves the web UI, with an SQLite database stored in a Docker volume.
On first start the container creates the database (migrations 001–006) and loads reproducible sample data automatically.
**From an empty folder the system starts with 2 commands** (section 2, steps 3–4).

## 1. Environment requirements

| Item | Requirement | Check with |
|---|---|---|
| OS | Windows 10/11 (Docker Desktop with WSL 2), macOS 12+, or Linux x86-64/ARM64 | – |
| Docker | Docker Engine **24+** or Docker Desktop **4.26+** | `docker --version` |
| Docker Compose | Compose **v2.24 or newer** (the file uses `env_file` with `required:`) | `docker compose version` |
| Git | any recent version | `git --version` |
| Disk space | about **1 GB** free (base image `node:22.20-alpine` + dependencies + data) | – |
| Memory | 512 MB free RAM for the container | – |
| Network port | **3000** free on the host (change `PORT` in `.env` if it is taken) | Windows: `netstat -ano \| findstr :3000` · Linux/macOS: `lsof -i :3000` |
| Internet | needed only for the first build (pull the base image and npm packages); the running app works offline | – |

Not needed on the host: Node.js, npm, a database server. (Optional manual run without Docker: Node.js **22.13+**, see section 2, "Alternative".)

## 2. Build and start steps

Run each command in a terminal (Git Bash, PowerShell, CMD or a Linux/macOS shell), one after another.

| # | Step | Command | Expected result |
|---|---|---|---|
| 1 | Get the code at the submitted tag | `git clone --branch v1.0 https://github.com/Ovenvanlang/cdtn1-phoutthavongkhanxay-l8.git` | folder `cdtn1-phoutthavongkhanxay-l8` created |
| 2 | Enter the folder | `cd cdtn1-phoutthavongkhanxay-l8` | – |
| 3 | Create the configuration file | `cp .env.example .env` (Windows CMD: `copy .env.example .env`) | file `.env` exists |
| 4 | Build the image and start in the background | `docker compose up -d --build` | `Container cdtn1-phoutthavongkhanxay-l8-app-1  Started` (first build ≈ 1–3 min) |
| 5 | Wait until the container is healthy | `docker compose ps` | column STATUS shows `Up … (healthy)` (≈ 15–30 s after start) |
| 6 | Open the UI | browser → `http://localhost:3000` | home page with links to the 3 screens |

Step 4 runs, inside the container: `migrate.js` (creates tables; re-running applies nothing) → `seeds/seed.js` (loads sample data only if the
database is empty) → the web server. No manual data step is needed.

**Run the automated tests with Docker only** (no Node.js on the host):

```bash
docker compose --profile test run --rm test
```
Expected last lines: `# tests 87` · `# pass 87` · `# fail 0`. The `test` service belongs to the `test` profile, so `docker compose up` never starts it.

**Stop / reset:**
`docker compose down` (stop, keep data) · `docker compose down -v` (stop and delete the data volume; the next `up` re-creates the same sample data).

**Alternative without Docker** (developer machine with Node.js 22.13+):
`npm ci` → `cp .env.example .env` → `npm run db:setup` → `npm test` → `npm start`.

## 3. Environment variables

All variables are read from `.env` (template: `.env.example`, which is committed; `.env` itself is ignored by Git and by the Docker build).

| Name | Meaning | Example value (from `.env.example`) | Required? | If missing |
|---|---|---|---|---|
| `AUTH_SECRET` | Secret key that signs login tokens (HMAC-SHA256). **Change it for any real deployment**: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | `khoa-ky-token-cho-moi-truong-hoc-tap-doi-lai-truoc-khi-dung-that` | **Yes** | server refuses to start: `Thiếu AUTH_SECRET…` |
| `PORT` | Port on the **host** (Docker maps `PORT` → container port 3000). Without Docker: port the server listens on | `3000` | No | `3000` |
| `DATABASE_FILE` | SQLite file path. In Docker it is fixed to `/app/data/khao-sat.db` (volume `csat_data`) by `docker-compose.yml` | `./data/khao-sat.db` | No | `./data/khao-sat.db` |
| `TOKEN_TTL_HOURS` | Login token lifetime in hours | `8` | No | `8` |
| `APP_TIMEZONE` | IANA time zone used to turn response timestamps into report dates | `Asia/Ho_Chi_Minh` | No | `Asia/Ho_Chi_Minh`; an invalid name stops the server at start-up |
| `DEMO_PASSWORD` | Password given to the 4 demo accounts **when the seed creates them** (changing it later does not change existing accounts) | `Demo@2026` | No | `Demo@2026` |

## 4. Sample data

**How it is loaded:** automatically on the first `docker compose up` (empty volume). Reload from scratch: `docker compose down -v` then
`docker compose up -d --build`. Without Docker: `npm run db:setup` (or `npm run seed -- --reset` to wipe and reload).
The data is simulated but **reproducible** (fixed random seed 42) and follows the case-study names and score distribution, so every machine gets
exactly the same numbers below.

| Table | Rows after loading | Notes |
|---|---:|---|
| `service_center` | 6 | the 6 centres of the case study (3 in Ho Chi Minh City, 2 in Can Tho, 1 in Hanoi) |
| `technician` | 38 | |
| `customer` | 300 | |
| `ticket` | 1,200 | codes `BH-000001/2025` …; 977 are `DA_DONG` (closed), closed between 01/01/2025 and 23/10/2026 |
| `survey_response` | 813 | 369 answered (`DA_TRA_LOI`) + 444 sent, not answered (`DA_GUI`) |
| `dim_date` | 1,096 | calendar 2024-01-01 … 2026-12-31 |
| `app_user` | 4 | `bgd`, `quanly.tt01` (centre *TTBH Quận 10*), `marketing`, `hethong` – password = `DEMO_PASSWORD` |

These counts are printed by the seed in the container log: `docker compose logs app` →
`Đã nạp dữ liệu mẫu (seed=42): 1200 phiếu, đã đóng=977, khảo sát đã gửi=813, đã trả lời=369` followed by one line per table.
Restarting the container prints `Đã có dữ liệu, bỏ qua.` – nothing is duplicated.

Optional: a 1,200-response extract of the **official case-study CSV** is in `data/sample/`; load it without Docker with `npm run import -- data/sample`
(re-running gives the same counts: 6 centres, 38 technicians, 1,400 tickets, 1,200 surveys).

## 5. How to verify the system works

Run these after step 5. The commands use Git Bash / Linux / macOS syntax; on Windows PowerShell type `curl.exe` instead of `curl`, or use the browser checks (5.4–5.5).

| # | Check | Command / action | Expected result |
|---|---|---|---|
| 5.1 | Container healthy | `docker compose ps` | `app` … `Up … (healthy)`, port `0.0.0.0:3000->3000/tcp` |
| 5.2 | Health endpoint | `curl -s http://localhost:3000/health` | `{"status":"ok"}` |
| 5.3 | Data loaded, login works, report correct | `TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"bgd","password":"Demo@2026"}' \| sed 's/.*"token":"\([^"]*\)".*/\1/')` then `curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/reports/csat?from=2024-01-01&to=2026-12-31"` | JSON starting `{"data":{"filters":{"center_id":null,"center_name":"Toàn hệ thống",…},"total_responses":369,…` |
| 5.4 | Web UI and login | browser → `http://localhost:3000/dang-nhap.html`, log in `bgd` / `Demo@2026` | redirected to **Báo cáo CSAT**: 4 KPI cards with "so với kỳ trước", score distribution and technician table filled (not empty) |
| 5.5 | Role restriction (QT-14) | log out, log in `quanly.tt01` / `Demo@2026` | the centre filter only offers *TTBH Quận 10* |
| 5.6 | Security of the public survey (BUG-006) | `curl -s -X POST http://localhost:3000/api/surveys/1 -H "Content-Type: application/json" -d '{"score":1}'` | `{"error":"DU_LIEU_KHONG_HOP_LE","message":"Thiếu mã truy cập t trong đường dẫn khảo sát","field":"t"}` |
| 5.7 | Automated tests | `docker compose --profile test run --rm test` | `# pass 87` · `# fail 0` |
| 5.8 | Re-run is safe (no duplicates) | `docker compose restart app` then `docker compose logs app --tail 5` | `CSDL đã ở phiên bản mới nhất.` and `Đã có dữ liệu, bỏ qua.`; 5.3 still returns `total_responses":369` |

**Troubleshooting**

| Symptom | Cause | Fix |
|---|---|---|
| `env file … .env not found` | step 3 skipped | `cp .env.example .env` |
| `Bind for 0.0.0.0:3000 failed: port is already allocated` | another program uses port 3000 | set `PORT=3001` in `.env`, run step 4 again, use `http://localhost:3001` |
| `docker compose ps` stays `(health: starting)` > 1 min | container still building data or crashed | `docker compose logs app` – the last lines show the error |
| `docker compose up` rejects the `env_file` section (`required` unknown / must be a string) | Docker Compose older than v2.24 | update Docker Desktop / Compose plugin |
| UI shows "Chưa có phản hồi" for the selected period | the chosen dates have no responses (data ends 23/10/2026 + up to 5 days) | choose a period in 2025–2026 or reset the filter |
