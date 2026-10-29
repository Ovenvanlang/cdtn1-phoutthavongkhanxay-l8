// Ráp các lớp theo sơ đồ kiến trúc: routes → services → repositories → CSDL.
const path = require('node:path');
const express = require('express');
const config = require('./config');
const { createAttachUser } = require('./middleware/access');
const { notFound, errorHandler } = require('./middleware/error-handler');
const { createTicketRepository } = require('./repositories/ticket.repository');
const { createSurveyRepository } = require('./repositories/survey.repository');
const { createUserRepository } = require('./repositories/user.repository');
const { createCenterRepository } = require('./repositories/center.repository');
const { createReportRepository } = require('./repositories/report.repository');
const { createAuthService } = require('./services/auth.service');
const { createSurveyService } = require('./services/survey.service');
const { createReportService } = require('./services/report.service');
const { createUserService } = require('./services/user.service');
const { createAuthRoutes } = require('./routes/auth.routes');
const { createSurveyRoutes } = require('./routes/surveys.routes');
const { createReportRoutes, createCenterRoutes } = require('./routes/reports.routes');
const { createUserRoutes } = require('./routes/users.routes');

const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const NODE_MODULES = path.join(__dirname, '..', '..', 'node_modules');

function createApp({ db, now, authSecret = config.authSecret, tokenTtlHours = config.tokenTtlHours } = {}) {
  const app = express();
  app.use(express.json({ limit: '10kb' }));

  // Repositories (chỉ SQL)
  const ticketRepo = createTicketRepository(db);
  const surveyRepo = createSurveyRepository(db);
  const userRepo = createUserRepository(db);
  const centerRepo = createCenterRepository(db);
  const reportRepo = createReportRepository(db);

  // Services (quy tắc nghiệp vụ)
  const authService = createAuthService({ userRepo, secret: authSecret, ttlHours: tokenTtlHours, now });
  const surveyService = createSurveyService({ surveyRepo, ticketRepo, now });
  const reportService = createReportService({ reportRepo, centerRepo, surveyService, now });
  const userService = createUserService({ userRepo, centerRepo });

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  // Mọi API đi qua Access Middleware: đọc token -> req.user (không có token = khách hàng)
  app.use('/api', createAttachUser(authService));
  app.use('/api/auth', createAuthRoutes(authService));
  app.use('/api/surveys', createSurveyRoutes(surveyService));
  app.use('/api/reports', createReportRoutes(reportService));
  app.use('/api/centers', createCenterRoutes(reportService));
  app.use('/api/users', createUserRoutes(userService));

  // Giao diện: src/frontend (cùng cổng nên gọi API bằng đường dẫn tương đối, không cần CORS)
  app.use(express.static(FRONTEND_DIR));
  // Chart.js phục vụ từ node_modules -> giao diện chạy được khi KHÔNG có Internet.
  // Kiểu dáng do assets/giao-dien.css tự định nghĩa (không dùng khung CSS ngoài).
  app.use('/vendor/chartjs', express.static(path.join(NODE_MODULES, 'chart.js', 'dist')));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
