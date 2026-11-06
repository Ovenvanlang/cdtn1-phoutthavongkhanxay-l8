# API Documentation – CSAT Survey Service (flow L8, Mekong Mobile)

Version 1.0.0 (BT3) · Base URL `http://localhost:3000` (port from `PORT` in `.env`) · JSON over HTTP, UTF-8.
Request collection you can run by hand: [`khao-sat.http`](khao-sat.http) (VS Code *REST Client* or JetBrains HTTP Client).

Every example below is copied from a **real run** on 07/11/2026 against a fresh database (`npm run db:setup`, seed 42, then `npm start`).
Only two edits were made: JWT-like tokens are shortened to `<token>`, and long arrays are cut after 1–2 items with a note `… (N more)`.
`sent_at`/`responded_at` values are the server time of that run.

## Conventions (apply to every endpoint)

| Topic | Rule |
|---|---|
| Authentication | Staff endpoints need `Authorization: Bearer <token>` from `POST /api/auth/login` (HMAC-SHA256 signed, expires after `TOKEN_TTL_HOURS`, default 8 h). No header = anonymous **customer** (only the public survey endpoints work). |
| Roles | `he_thong` (system actor that creates surveys), `quan_ly` (centre manager, bound to one centre), `bgd` (board of directors, whole company), `marketing` (company-wide aggregates only). |
| Success body | `{"data": …}`; list endpoints add `"meta": {"page", "limit", "total"}`. |
| Error body | `{"error": "<CODE>", "message": "<Vietnamese text for the UI>", "field"?: "<input field>"}` – never a stack trace, SQL or table name. |
| Error code → HTTP | `DU_LIEU_KHONG_HOP_LE` 400 (invalid input / malformed JSON / body > 10 kB) · `CHUA_DANG_NHAP` 401 · `TOKEN_KHONG_HOP_LE` 401 (bad signature, expired, disabled account) · `SAI_TAI_KHOAN_HOAC_MAT_KHAU` 401 · `KHONG_DU_QUYEN` 403 · `KHONG_TIM_THAY` 404 · `PHIEU_CHUA_DONG`, `DA_KHAO_SAT`, `TEN_DANG_NHAP_DA_TON_TAI`, `KHONG_TU_THAO_TAC`, `PHAI_CON_MOT_BGD` 409 · `LOI_HE_THONG` 500 (unexpected; logged server-side). |
| Common 401/403 | Every endpoint marked "login required" returns **401 `CHUA_DANG_NHAP`** without a token, **401 `TOKEN_KHONG_HOP_LE`** with a tampered/expired token, and **403 `KHONG_DU_QUYEN`** for a role not listed. These rows are not repeated in each table. |
| Pagination | `page` ≥ 1 (default 1), `limit` 1–100 (default 20). |
| Dates | Query dates are `YYYY-MM-DD` and must exist on the calendar. Timestamps are stored and returned in ISO 8601 UTC; a response is counted on its **Vietnam-time** date (`APP_TIMEZONE`, default `Asia/Ho_Chi_Minh`). |
| Unknown path | `404 {"error":"KHONG_TIM_THAY","message":"Không có đường dẫn GET /api/khong-co"}` |

## Endpoint index

| # | Method & path | Purpose | Who |
|---|---|---|---|
| 1 | `GET /health` | Liveness check (Docker HEALTHCHECK) | public |
| 2 | `POST /api/auth/login` | Log in, get a token | public |
| 3 | `GET /api/auth/me` | Current session | any staff |
| 4 | `POST /api/surveys` | UC1 – create the survey of a closed ticket | `he_thong` |
| 5 | `GET /api/surveys` | List surveys/responses (staff) | `quan_ly`, `bgd` |
| 6 | `GET /api/surveys/:ticketId?t=` | UC2 – customer opens the survey link | customer (link code) |
| 7 | `POST /api/surveys/:ticketId?t=` | UC2 – customer submits score + comment | customer (link code) |
| 8 | `DELETE /api/surveys/:ticketId` | Soft-delete a survey (QT-13) | `quan_ly`, `bgd` |
| 9 | `GET /api/reports/csat` | UC3 + UC4 – CSAT by centre and technician | `quan_ly`, `bgd`, `marketing` |
| 10 | `GET /api/reports/trend` | UC5 – CSAT trend by month/quarter | `quan_ly`, `bgd`, `marketing` |
| 11 | `GET /api/reports/low-score` | UC6 – responses scored ≤ 2 | `quan_ly`, `bgd` |
| 12 | `GET /api/centers` | Centres for the report filter | `quan_ly`, `bgd`, `marketing` |
| 13 | `GET /api/users` | List accounts | `bgd` |
| 14 | `GET /api/users/:id` | Read one account | `bgd` |
| 15 | `POST /api/users` | Create an account | `bgd` |
| 16 | `PATCH /api/users/:id` | Update an account | `bgd` |
| 17 | `DELETE /api/users/:id` | Deactivate an account (soft delete) | `bgd` |

---

## 1. `GET /health`
1. **Method & path:** `GET /health`
2. **Business description:** tells Docker (and the grader) the web server is up; used by the `HEALTHCHECK` in `Dockerfile`.
3. **Authentication:** none.
4. **Parameters & body:** none.
5. **Success response:** `200 {"status":"ok"}`
6. **Error codes:** none defined (if the process is down the connection is refused).
7. **Notes & limits:** does not query the database; the container is only reported `healthy` after migrations and seed have finished, because the server starts last.

```http
GET /health
→ 200
{"status":"ok"}
```

## 2. `POST /api/auth/login`
1. **Method & path:** `POST /api/auth/login`
2. **Business description:** staff log in with username/password and receive a signed token used by all staff endpoints.
3. **Authentication:** none.
4. **Parameters & body:**

| Field | Type | Required | Rule |
|---|---|---|---|
| `username` | string | yes | trimmed, not empty |
| `password` | string | yes | not empty |

5. **Success response:** `200 {"data":{"token","expires_at","user":{"username","full_name","role","center_id"}}}`
6. **Error codes:**

| HTTP | `error` | When |
|---|---|---|
| 400 | `DU_LIEU_KHONG_HOP_LE` (`field`: `username`/`password`) | field missing or not a string; malformed JSON |
| 401 | `SAI_TAI_KHOAN_HOAC_MAT_KHAU` | wrong username **or** password, or account deactivated (same message – no user enumeration) |

7. **Notes & limits:** passwords are verified against a scrypt hash with a constant-time compare; an unknown username still runs one hash (`DUMMY_HASH`) so timing does not reveal which accounts exist. Token lifetime `TOKEN_TTL_HOURS` (default 8). No rate limiting in this prototype (see security checklist).

```http
POST /api/auth/login
Content-Type: application/json

{"username":"bgd","password":"Demo@2026"}
→ 200
{"data":{"token":"<token>","expires_at":"2026-11-07T02:20:56.000Z",
 "user":{"username":"bgd","full_name":"Ban giám đốc","role":"bgd","center_id":null}}}

{"username":"bgd","password":"sai-mat-khau"}
→ 401 {"error":"SAI_TAI_KHOAN_HOAC_MAT_KHAU","message":"Tên đăng nhập hoặc mật khẩu không đúng"}

{"username":"bgd"}
→ 400 {"error":"DU_LIEU_KHONG_HOP_LE","message":"password là bắt buộc","field":"password"}
```

## 3. `GET /api/auth/me`
1. **Method & path:** `GET /api/auth/me`
2. **Business description:** the front-end shows the logged-in name/role and checks that the stored token is still valid.
3. **Authentication:** login required (any staff role).
4. **Parameters & body:** none.
5. **Success response:** `200 {"data":{"name","role","center_id"}}`
6. **Error codes:** only the common 401s.
7. **Notes & limits:** a deactivated account's token is rejected immediately (401 `TOKEN_KHONG_HOP_LE`) even before it expires.

```http
GET /api/auth/me
Authorization: Bearer <token of quanly.tt01>
→ 200 {"data":{"name":"Quản lý trung tâm TTBH Quận 10","role":"quan_ly","center_id":1}}

GET /api/auth/me            (no header)
→ 401 {"error":"CHUA_DANG_NHAP","message":"Cần đăng nhập để dùng chức năng này"}
GET /api/auth/me            (token with its last character changed)
→ 401 {"error":"TOKEN_KHONG_HOP_LE","message":"Phiên đăng nhập không hợp lệ hoặc đã hết hạn"}
```

## 4. `POST /api/surveys` — UC1 create survey
1. **Method & path:** `POST /api/surveys`
2. **Business description:** when a warranty ticket is closed, the system actor creates exactly one survey for it (QT-10) and receives the link to send to the customer.
3. **Authentication:** login required, role `he_thong`.
4. **Parameters & body:**

| Field | Type | Required | Rule |
|---|---|---|---|
| `ticket_id` | integer (or numeric string) | yes | positive integer |

5. **Success response:** `201 {"data": <survey>}` where `<survey>` = `response_id, ticket_id, ticket_code, center_id, center_name, closed_at, status ("DA_GUI"), sent_at, score (null), comment (null), responded_at (null), low_score (false), survey_link`. `survey_link` = `/khao-sat.html?ticket=<id>&t=<32-hex access code>`.
6. **Error codes:**

| HTTP | `error` | When |
|---|---|---|
| 400 | `DU_LIEU_KHONG_HOP_LE` (`field: ticket_id`) | missing / not a positive integer |
| 404 | `KHONG_TIM_THAY` | ticket does not exist |
| 409 | `PHIEU_CHUA_DONG` | ticket status is not `DA_DONG` (QT-10) |
| 409 | `DA_KHAO_SAT` | a survey already exists for this ticket, including a soft-deleted one (QT-10; also enforced by `UNIQUE(ticket_id)`) |

7. **Notes & limits:** `survey_link` is returned **only here**, to the system actor; it is the customer's only credential (BUG-006, TD-30). The access code is 128-bit random (`randomblob(16)`). Closing tickets belongs to flow L2/L4, so this endpoint is the integration point (TD-25).

```http
POST /api/surveys
Authorization: Bearer <token of hethong>
Content-Type: application/json

{"ticket_id":8}
→ 201
{"data":{"response_id":814,"ticket_id":8,"ticket_code":"BH-000008/2025","center_id":1,"center_name":"TTBH Quận 10",
 "closed_at":"2025-01-05T09:46:00.000Z","status":"DA_GUI","sent_at":"2026-11-06T18:20:56.379Z","score":null,
 "comment":null,"responded_at":null,"low_score":false,
 "survey_link":"/khao-sat.html?ticket=8&t=9dadf7e02d14dc00a89643ffaf59851a"}}

{"ticket_id":8}      (again)  → 409 {"error":"DA_KHAO_SAT","message":"Mỗi phiếu chỉ khảo sát một lần (QT-10)"}
{"ticket_id":15}     (open)   → 409 {"error":"PHIEU_CHUA_DONG","message":"Chỉ khảo sát phiếu ở trạng thái ĐÃ ĐÓNG (QT-10)"}
{"ticket_id":999999}          → 404 {"error":"KHONG_TIM_THAY","message":"Không có phiếu bảo hành này"}
marketing token               → 403 {"error":"KHONG_DU_QUYEN","message":"Vai trò marketing không có quyền"}
```

## 5. `GET /api/surveys` — staff list
1. **Method & path:** `GET /api/surveys`
2. **Business description:** managers follow up on responses (e.g. call customers who scored low); the board sees all centres.
3. **Authentication:** login required, roles `quan_ly`, `bgd`.
4. **Parameters (query):**

| Name | Type | Required | Rule |
|---|---|---|---|
| `status` | string | no | `DA_GUI` or `DA_TRA_LOI` |
| `center_id` | integer | no | positive; a manager may only pass **their own** centre |
| `score_max` | integer | no | 1–5 (e.g. `2` = low scores) |
| `page`, `limit` | integer | no | see Conventions |

5. **Success response:** `200 {"data":[<staff survey>…],"meta":{"page","limit","total"}}`; a staff survey adds `technician_id, technician_name, customer_name, customer_phone` to the public fields. Sorted by latest activity (`responded_at`, else `sent_at`) descending; soft-deleted rows excluded.
6. **Error codes:**

| HTTP | `error` | When |
|---|---|---|
| 400 | `DU_LIEU_KHONG_HOP_LE` (`field`) | bad `status`, `score_max` outside 1–5, bad `center_id`/`page`/`limit` |
| 403 | `KHONG_DU_QUYEN` | manager asks for another centre (QT-14) |

7. **Notes & limits:** a manager without `center_id` gets only their centre automatically (QT-14). Both roles see the **full** phone number – required for call-back (QT-15). Marketing is refused (BS-05).

```http
GET /api/surveys?score_max=2&limit=2
Authorization: Bearer <token of quanly.tt01>
→ 200
{"data":[{"response_id":814,"ticket_id":8,"ticket_code":"BH-000008/2025","center_id":1,"center_name":"TTBH Quận 10",
  "closed_at":"2025-01-05T09:46:00.000Z","technician_id":5,"technician_name":"Đặng Quang An",
  "customer_name":"Phạm Đức Châu","customer_phone":"0322506671","status":"DA_TRA_LOI",
  "sent_at":"2026-11-06T18:20:56.379Z","score":2,"comment":"Sửa lâu, hẹn hai lần mới xong",
  "responded_at":"2026-11-06T18:20:56.404Z","low_score":true},
  … (1 more)],
 "meta":{"page":1,"limit":2,"total":9}}

GET /api/surveys?center_id=2   (quanly.tt01) → 403 {"error":"KHONG_DU_QUYEN","message":"Không được xem dữ liệu trung tâm khác (QT-14)"}
GET /api/surveys?score_max=9   (bgd)         → 400 {"error":"DU_LIEU_KHONG_HOP_LE","message":"score_max phải từ 1 đến 5","field":"score_max"}
```

## 6. `GET /api/surveys/:ticketId?t=<code>` — customer opens the link
1. **Method & path:** `GET /api/surveys/:ticketId?t=<access code>`
2. **Business description:** the survey page `khao-sat.html` loads the ticket card (code, centre, closing date) and whether it was already answered.
3. **Authentication:** no login; the **access code `t`** from the link is required and must match this survey.
4. **Parameters:**

| Name | In | Required | Rule |
|---|---|---|---|
| `ticketId` | path | yes | positive integer |
| `t` | query | yes | exactly 32 lowercase hex characters |

5. **Success response:** `200 {"data": <survey without survey_link>}` – no customer name, phone or technician.
6. **Error codes:**

| HTTP | `error` | When |
|---|---|---|
| 400 | `DU_LIEU_KHONG_HOP_LE` (`field: t` or `ticket_id`) | code missing / malformed; bad ticket id |
| 404 | `KHONG_TIM_THAY` | wrong code, unknown ticket, or survey soft-deleted – **same answer** so an attacker cannot tell which |

7. **Notes & limits:** codes are compared in constant time. The code does not expire in this version (a survey can only be answered once anyway, QT-10).

```http
GET /api/surveys/8?t=9dadf7e02d14dc00a89643ffaf59851a
→ 200
{"data":{"response_id":814,"ticket_id":8,"ticket_code":"BH-000008/2025","center_id":1,"center_name":"TTBH Quận 10",
 "closed_at":"2025-01-05T09:46:00.000Z","status":"DA_GUI","sent_at":"2026-11-06T18:20:56.379Z","score":null,
 "comment":null,"responded_at":null,"low_score":false}}

GET /api/surveys/8                                  → 400 {"error":"DU_LIEU_KHONG_HOP_LE","message":"Thiếu mã truy cập t trong đường dẫn khảo sát","field":"t"}
GET /api/surveys/8?t=00000000000000000000000000000000 → 404 {"error":"KHONG_TIM_THAY","message":"Khảo sát không khả dụng"}
```

## 7. `POST /api/surveys/:ticketId?t=<code>` — UC2 submit response
1. **Method & path:** `POST /api/surveys/:ticketId?t=<access code>`
2. **Business description:** the customer rates the service 1–5 with an optional comment; scores ≤ 2 are flagged `low_score` for follow-up (BS-03).
3. **Authentication:** no login; access code `t` required (as endpoint 6).
4. **Parameters & body:** path/query as endpoint 6, plus body:

| Field | Type | Required | Rule |
|---|---|---|---|
| `score` | integer | yes | 1–5 (no decimals, no strings) |
| `comment` | string | no | trimmed, ≤ 500 characters; empty → `null` |

5. **Success response:** `200 {"data": <survey>}` with `status "DA_TRA_LOI"`, `score`, `comment`, `responded_at`, `low_score`.
6. **Error codes:**

| HTTP | `error` | When |
|---|---|---|
| 400 | `DU_LIEU_KHONG_HOP_LE` (`field: score` / `comment` / `t`) | score missing/out of range/not integer; comment > 500 or not a string; code missing; malformed JSON |
| 404 | `KHONG_TIM_THAY` | wrong code, unknown or soft-deleted survey |
| 409 | `DA_KHAO_SAT` | already answered – the first answer is kept (QT-10, also safe under concurrent submits) |

7. **Notes & limits:** the response date used by reports is the Vietnam-time date of `responded_at` (BUG-007). Body limit 10 kB.

```http
POST /api/surveys/8?t=9dadf7e02d14dc00a89643ffaf59851a
Content-Type: application/json

{"score":2,"comment":"Sửa lâu, hẹn hai lần mới xong"}
→ 200
{"data":{"response_id":814,"ticket_id":8,"ticket_code":"BH-000008/2025","center_id":1,"center_name":"TTBH Quận 10",
 "closed_at":"2025-01-05T09:46:00.000Z","status":"DA_TRA_LOI","sent_at":"2026-11-06T18:20:56.379Z","score":2,
 "comment":"Sửa lâu, hẹn hai lần mới xong","responded_at":"2026-11-06T18:20:56.404Z","low_score":true}}

{"score":6}                    → 400 {"error":"DU_LIEU_KHONG_HOP_LE","message":"score là bắt buộc, phải là số nguyên từ 1 đến 5","field":"score"}
{"score":5}   (second time)    → 409 {"error":"DA_KHAO_SAT","message":"Mỗi phiếu chỉ khảo sát một lần (QT-10)"}
POST /api/surveys/8 (no t)     → 400 {"error":"DU_LIEU_KHONG_HOP_LE","message":"Thiếu mã truy cập t trong đường dẫn khảo sát","field":"t"}
```

## 8. `DELETE /api/surveys/:ticketId` — soft delete
1. **Method & path:** `DELETE /api/surveys/:ticketId`
2. **Business description:** remove an invalid/duplicate response from reports without losing the record (QT-13).
3. **Authentication:** login required, roles `quan_ly` (own centre only), `bgd`.
4. **Parameters:** `ticketId` (path, positive integer). No body.
5. **Success response:** `200 {"data":{"ticket_id":<id>,"deleted":true}}`
6. **Error codes:**

| HTTP | `error` | When |
|---|---|---|
| 400 | `DU_LIEU_KHONG_HOP_LE` (`field: ticket_id`) | bad id |
| 403 | `KHONG_DU_QUYEN` | manager deleting another centre's survey (QT-14) |
| 404 | `KHONG_TIM_THAY` | ticket unknown, no survey, or already deleted |

7. **Notes & limits:** sets `is_deleted = 1`; the row stays in the database, disappears from lists and reports, the customer link returns 404, and the ticket can **not** get a new survey (QT-10).

```http
DELETE /api/surveys/8
Authorization: Bearer <token of quanly.tt01>
→ 200 {"data":{"ticket_id":8,"deleted":true}}
(again) → 404 {"error":"KHONG_TIM_THAY","message":"Khảo sát không khả dụng"}
DELETE /api/surveys/13   (centre 2, by quanly.tt01) → 403 {"error":"KHONG_DU_QUYEN","message":"Không được thao tác trung tâm khác (QT-14)"}
```

## 9. `GET /api/reports/csat` — UC3 + UC4
1. **Method & path:** `GET /api/reports/csat`
2. **Business description:** CSAT % (BS-01), average score, score distribution and per-technician table for a centre and period, with a comparison baseline (BS-06).
3. **Authentication:** login required, roles `quan_ly`, `bgd`, `marketing`.
4. **Parameters (query):**

| Name | Type | Required | Rule / default |
|---|---|---|---|
| `center_id` | integer | no | `bgd`: any centre or none (= whole company); `quan_ly`: own centre (default); `marketing`: must be omitted |
| `from` | date | no | default 1 January of the current year (Vietnam time) |
| `to` | date | no | default today (Vietnam time); `from` ≤ `to` |

5. **Success response:** `200 {"data":{filters, total_responses, closed_tickets, csat_percent, avg_score, high_score_count, low_score_count, distribution{1..5}, warning, min_sample, by_technician[], comparison{previous, csat_delta, company}}, "meta":{"generated_at"}}`.
   `csat_percent` = responses with score ≥ 4 ÷ answered responses × 100, 1 decimal; `DA_GUI` surveys are not in the denominator.
6. **Error codes:**

| HTTP | `error` | When |
|---|---|---|
| 400 | `DU_LIEU_KHONG_HOP_LE` (`field: from/to/center_id`) | not a real `YYYY-MM-DD` date (e.g. `2026-02-30`), `from` > `to`, bad id |
| 403 | `KHONG_DU_QUYEN` | manager asks for another centre (QT-14); marketing passes `center_id` (BS-05) |
| 404 | `KHONG_TIM_THAY` | centre does not exist |

7. **Notes & limits:** fewer than 5 responses → numbers are still returned with `warning: "MAU_CHUA_DU_TIN_CAY"` (BS-02); no responses → `csat_percent: null` and `warning: "CHUA_CO_PHAN_HOI"` (never 0 %). `comparison.previous` is the period of the same length right before `from`; `comparison.company` (whole-company figure) only when `bgd` filters one centre. Marketing receives `by_technician: null` (BS-05).

```http
GET /api/reports/csat?center_id=1&from=2026-10-01&to=2026-10-31
Authorization: Bearer <token of bgd>
→ 200
{"data":{"filters":{"center_id":1,"center_name":"TTBH Quận 10","from":"2026-10-01","to":"2026-10-31"},
 "total_responses":2,"closed_tickets":7,"csat_percent":100,"avg_score":4.5,"high_score_count":2,"low_score_count":0,
 "distribution":{"1":0,"2":0,"3":0,"4":1,"5":1},"warning":"MAU_CHUA_DU_TIN_CAY","min_sample":5,
 "by_technician":[{"technician_id":3,"full_name":"Ngô Thanh Hà","level":"CAO_CAP","total_responses":1,"csat_percent":100,
   "avg_score":5,"low_score_count":0,"warning":"MAU_CHUA_DU_TIN_CAY"}, … (1 more)],
 "comparison":{"previous":{"from":"2026-08-31","to":"2026-09-30","total_responses":4,"csat_percent":75,"avg_score":4,"low_score_count":1},
   "csat_delta":25,
   "company":{"from":"2026-10-01","to":"2026-10-31","total_responses":15,"csat_percent":66.7,"avg_score":3.67,"low_score_count":3}}},
 "meta":{"generated_at":"2026-11-06T18:20:56.438Z"}}

GET /api/reports/csat?from=2024-01-01&to=2024-01-31 (bgd) → 200 … "total_responses":0,"csat_percent":null,"warning":"CHUA_CO_PHAN_HOI" …
GET /api/reports/csat?center_id=1   (marketing)  → 403 {"error":"KHONG_DU_QUYEN","message":"Marketing chỉ xem số liệu tổng hợp toàn hệ thống (BS-05)"}
GET /api/reports/csat?from=2026-02-30 (bgd)      → 400 {"error":"DU_LIEU_KHONG_HOP_LE","message":"from phải là ngày hợp lệ dạng YYYY-MM-DD","field":"from"}
GET /api/reports/csat?from=2026-10-31&to=2026-10-01 → 400 {"error":"DU_LIEU_KHONG_HOP_LE","message":"from phải nhỏ hơn hoặc bằng to","field":"from"}
GET /api/reports/csat?center_id=99  (bgd)        → 404 {"error":"KHONG_TIM_THAY","message":"Không có trung tâm này"}
```

## 10. `GET /api/reports/trend` — UC5
1. **Method & path:** `GET /api/reports/trend`
2. **Business description:** CSAT per month or quarter of one year, with the yearly average as a reference line.
3. **Authentication:** login required, roles `quan_ly`, `bgd`, `marketing`.
4. **Parameters (query):**

| Name | Type | Required | Rule / default |
|---|---|---|---|
| `granularity` | string | no | `month` (default) or `quarter` |
| `year` | integer | no | 4 digits, 2000–2100; default current year (Vietnam time) |
| `center_id` | integer | no | same scope rules as endpoint 9 |

5. **Success response:** `200 {"data":{"filters","year_summary","points":[{"period","label","total_responses","csat_percent","avg_score","warning"}]},"meta":{"generated_at","min_sample"}}`. `period` is the month (1–12) or quarter (1–4) number.
6. **Error codes:** 400 `DU_LIEU_KHONG_HOP_LE` (`field: granularity/year/center_id`); 403/404 as endpoint 9.
7. **Notes & limits:** periods with no responses are **omitted**, never interpolated. Each point carries `MAU_CHUA_DU_TIN_CAY` when it has < 5 responses.

```http
GET /api/reports/trend?granularity=quarter&year=2026
Authorization: Bearer <token of quanly.tt01>
→ 200
{"data":{"filters":{"center_id":1,"granularity":"quarter","year":2026},
 "year_summary":{"from":"2026-01-01","to":"2026-12-31","total_responses":30,"csat_percent":76.7,"avg_score":3.97,"low_score_count":4},
 "points":[{"period":1,"label":"Q1/2026","total_responses":8,"csat_percent":75,"avg_score":4,"warning":null}, … (3 more)]},
 "meta":{"generated_at":"2026-11-06T18:20:56.453Z","min_sample":5}}

GET /api/reports/trend?granularity=week → 400 {"error":"DU_LIEU_KHONG_HOP_LE","message":"granularity phải là một trong: month, quarter","field":"granularity"}
```

## 11. `GET /api/reports/low-score` — UC6
1. **Method & path:** `GET /api/reports/low-score`
2. **Business description:** answered responses with score ≤ 2 so the centre can call the customer back.
3. **Authentication:** login required, roles `quan_ly`, `bgd`.
4. **Parameters (query):** `center_id` (scope rules as endpoint 5), `page`, `limit`.
5. **Success response:** same shape as endpoint 5, `meta` adds `"low_score_threshold": 2`.
6. **Error codes:** 400 `DU_LIEU_KHONG_HOP_LE` (e.g. `limit` > 100); 403 for marketing or another centre.
7. **Notes & limits:** contains the full customer phone (QT-15) – this is why marketing is refused.

```http
GET /api/reports/low-score?limit=2
Authorization: Bearer <token of quanly.tt01>
→ 200
{"data":[{"response_id":766,"ticket_id":1132,"ticket_code":"BH-001132/2026","center_id":1,"center_name":"TTBH Quận 10",
  "closed_at":"2026-09-19T08:08:00.000Z","technician_id":8,"technician_name":"Vũ Văn Giang","customer_name":"Bùi Thị Ngân",
  "customer_phone":"0706634930","status":"DA_TRA_LOI","sent_at":"2026-09-19T08:08:00.000Z","score":1,
  "comment":"Trễ hẹn cả tuần không ai báo","responded_at":"2026-09-22T07:59:00.000Z","low_score":true}, … (1 more)],
 "meta":{"page":1,"limit":2,"total":8,"low_score_threshold":2}}

GET /api/reports/low-score   (marketing) → 403 {"error":"KHONG_DU_QUYEN","message":"Vai trò marketing không có quyền"}
GET /api/reports/low-score?limit=500     → 400 {"error":"DU_LIEU_KHONG_HOP_LE","message":"limit tối đa 100","field":"limit"}
```
*(The first item is the response submitted in example 7; it was soft-deleted in example 8, so it no longer appears here.)*

## 12. `GET /api/centers`
1. **Method & path:** `GET /api/centers`
2. **Business description:** fills the centre drop-down on the report pages.
3. **Authentication:** login required, roles `quan_ly`, `bgd`, `marketing`.
4. **Parameters & body:** none.
5. **Success response:** `200 {"data":[{"center_id","center_name","city"}]}` – `bgd`: all 6 centres; `quan_ly`: only their centre; `marketing`: empty list (BS-05).
6. **Error codes:** only the common 401/403.
7. **Notes & limits:** sorted by centre name.

```http
GET /api/centers   (bgd)          → 200 {"data":[{"center_id":5,"center_name":"TTBH Cái Răng","city":"Cần Thơ"}, … (5 more)]}
GET /api/centers   (quanly.tt01)  → 200 {"data":[{"center_id":1,"center_name":"TTBH Quận 10","city":"TP. Hồ Chí Minh"}]}
```

## 13. `GET /api/users`
1. **Method & path:** `GET /api/users`
2. **Business description:** the board manages who can use the system (TD-21).
3. **Authentication:** login required, role `bgd` only.
4. **Parameters (query):** `role` (`he_thong`/`quan_ly`/`bgd`/`marketing`), `center_id`, `is_active` (`true`/`false`), `page`, `limit`.
5. **Success response:** `200 {"data":[{"user_id","username","full_name","role","center_id","center_name","is_active"}],"meta":{…}}` – `password_hash` is **never** returned.
6. **Error codes:** 400 `DU_LIEU_KHONG_HOP_LE` (bad filter); common 401/403.
7. **Notes & limits:** deactivated accounts are included unless `is_active=true` is passed.

```http
GET /api/users?role=quan_ly&limit=2   (bgd)
→ 200 {"data":[{"user_id":2,"username":"quanly.tt01","full_name":"Quản lý trung tâm TTBH Quận 10","role":"quan_ly",
  "center_id":1,"center_name":"TTBH Quận 10","is_active":true}],"meta":{"page":1,"limit":2,"total":1}}
GET /api/users   (quanly.tt01) → 403 {"error":"KHONG_DU_QUYEN","message":"Vai trò quan_ly không có quyền"}
```

## 14. `GET /api/users/:id`
1. **Method & path:** `GET /api/users/:id`
2. **Business description:** view one account before editing it.
3. **Authentication:** login required, role `bgd`.
4. **Parameters:** `id` (path, positive integer).
5. **Success response:** `200 {"data": <user>}` (same fields as endpoint 13).
6. **Error codes:** 400 (`field: user_id`); 404 `KHONG_TIM_THAY` (no such account).
7. **Notes & limits:** none.

```http
GET /api/users/5     → 200 {"data":{"user_id":5,"username":"quanly.tt02","full_name":"Quản lý Tân Bình","role":"quan_ly","center_id":2,"center_name":"TTBH Quận Tân Bình","is_active":true}}
GET /api/users/9999  → 404 {"error":"KHONG_TIM_THAY","message":"Không có tài khoản này"}
```

## 15. `POST /api/users`
1. **Method & path:** `POST /api/users`
2. **Business description:** create an account; a centre manager must be bound to exactly one centre (QT-14), usernames are unique (TK-01).
3. **Authentication:** login required, role `bgd`.
4. **Body:**

| Field | Type | Required | Rule |
|---|---|---|---|
| `username` | string | yes | 3–40 chars `a-z 0-9 . _ -` |
| `password` | string | yes | 8–72 chars, at least one letter and one digit |
| `full_name` | string | yes | 1–120 chars after trim |
| `role` | string | yes | `he_thong`, `quan_ly`, `bgd`, `marketing` |
| `center_id` | integer | `quan_ly`: yes; others: must be empty | existing centre |

5. **Success response:** `201 {"data": <user>}`.
6. **Error codes:**

| HTTP | `error` | When |
|---|---|---|
| 400 | `DU_LIEU_KHONG_HOP_LE` (`field`) | any rule above; manager without centre / non-manager with centre; unknown centre; malformed JSON |
| 409 | `TEN_DANG_NHAP_DA_TON_TAI` | username already used |

7. **Notes & limits:** the password is stored as a scrypt hash with a random salt; it is never logged or returned.

```http
POST /api/users   (bgd)
Content-Type: application/json

{"username":"quanly.tt02","password":"QuanLy2026","full_name":"Quản lý Tân Bình","role":"quan_ly","center_id":2}
→ 201 {"data":{"user_id":5,"username":"quanly.tt02","full_name":"Quản lý Tân Bình","role":"quan_ly","center_id":2,
  "center_name":"TTBH Quận Tân Bình","is_active":true}}

(same again)                                   → 409 {"error":"TEN_DANG_NHAP_DA_TON_TAI","message":"Tên đăng nhập đã được dùng"}
{"username":"quanly.tt03",…,"role":"quan_ly"}  → 400 {"error":"DU_LIEU_KHONG_HOP_LE","message":"Tài khoản Quản lý trung tâm phải gắn với một trung tâm (QT-14)","field":"center_id"}
{"username":"abc","password":"short",…}        → 400 {"error":"DU_LIEU_KHONG_HOP_LE","message":"password phải dài từ 8 đến 72 ký tự","field":"password"}
{"username":"x", "password":                   → 400 {"error":"DU_LIEU_KHONG_HOP_LE","message":"Nội dung gửi lên không phải JSON hợp lệ"}
```

## 16. `PATCH /api/users/:id`
1. **Method & path:** `PATCH /api/users/:id`
2. **Business description:** change name, role, centre, password, or re-activate an account.
3. **Authentication:** login required, role `bgd`.
4. **Body (send only fields to change, at least one):** `full_name`, `role`, `center_id`, `password` (same rules as endpoint 15), `is_active` (boolean). `username` cannot be changed.
5. **Success response:** `200 {"data": <user>}`.
6. **Error codes:**

| HTTP | `error` | When |
|---|---|---|
| 400 | `DU_LIEU_KHONG_HOP_LE` (`field`) | invalid value, empty body, `username` present, role/centre combination breaks QT-14 |
| 404 | `KHONG_TIM_THAY` | no such account |
| 409 | `KHONG_TU_THAO_TAC` | changing your own role or deactivating yourself (TK-02) |
| 409 | `PHAI_CON_MOT_BGD` | the change would leave no active `bgd` account (TK-03) |

7. **Notes & limits:** a password change takes effect immediately for the next login; existing tokens stay valid until they expire.

```http
PATCH /api/users/5   {"full_name":"Quản lý TTBH Tân Bình","center_id":2}
→ 200 {"data":{"user_id":5,"username":"quanly.tt02","full_name":"Quản lý TTBH Tân Bình","role":"quan_ly","center_id":2,
  "center_name":"TTBH Quận Tân Bình","is_active":true}}
PATCH /api/users/5   {"username":"doi-ten"} → 400 {"error":"DU_LIEU_KHONG_HOP_LE","message":"username không được đổi sau khi tạo","field":"username"}
PATCH /api/users/3   {"role":"marketing"}   (3 = the caller) → 409 {"error":"KHONG_TU_THAO_TAC","message":"Không được tự đổi vai trò hoặc tự khóa tài khoản của chính mình"}
```

## 17. `DELETE /api/users/:id`
1. **Method & path:** `DELETE /api/users/:id`
2. **Business description:** remove someone's access without deleting history (QT-13).
3. **Authentication:** login required, role `bgd`.
4. **Parameters:** `id` (path). No body.
5. **Success response:** `200 {"data":{"user_id":<id>,"is_active":false}}`
6. **Error codes:** 400 (`field: user_id`); 404 `KHONG_TIM_THAY`; 409 `KHONG_TU_THAO_TAC` (yourself); 409 `PHAI_CON_MOT_BGD` (last active board account).
7. **Notes & limits:** soft delete – the row stays; login and existing tokens of that account are refused from the next request. Re-activate with `PATCH {"is_active":true}`.

```http
DELETE /api/users/5  → 200 {"data":{"user_id":5,"is_active":false}}
DELETE /api/users/3  (caller) → 409 {"error":"KHONG_TU_THAO_TAC","message":"Không được tự đổi vai trò hoặc tự khóa tài khoản của chính mình"}
POST /api/auth/login {"username":"quanly.tt02","password":"QuanLy2026"} → 401 {"error":"SAI_TAI_KHOAN_HOAC_MAT_KHAU",…}
```
