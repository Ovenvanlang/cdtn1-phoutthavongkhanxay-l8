# Đóng gói ứng dụng khảo sát CSAT (backend Express + giao diện tĩnh + SQLite) – theo bài 44 và 44a.
# ---------- GIAI ĐOẠN 1: cài phụ thuộc (chỉ thư viện chạy, không có jsdom của test) ----------
# Ảnh nền GHIM phiên bản: node:sqlite cần Node >= 22.13 (TD-12)
FROM node:22.20-alpine AS deps
WORKDIR /app
# Chép RIÊNG tệp khoá trước để dùng lại cache khi mã đổi mà phụ thuộc không đổi
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------- GIAI ĐOẠN 2: ảnh chạy ----------
FROM node:22.20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_FILE=/app/data/khao-sat.db
# Chạy bằng người dùng không đặc quyền; thư mục data/ (gắn volume) thuộc về người dùng đó
RUN addgroup -S app && adduser -S app -G app && mkdir -p /app/data && chown app:app /app/data
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY migrations ./migrations
COPY seeds ./seeds
COPY data/sample ./data/sample
USER app
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=6 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Khởi động: migration (chạy lại không lỗi) -> seed (đã có dữ liệu thì bỏ qua) -> máy chủ
CMD ["sh", "-c", "node --disable-warning=ExperimentalWarning src/backend/db/migrate.js && node --disable-warning=ExperimentalWarning seeds/seed.js && exec node --disable-warning=ExperimentalWarning src/backend/server.js"]
