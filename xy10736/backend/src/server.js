require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

const trackingRoutes = require('./routes/tracking');
const sessionRoutes = require('./routes/session');
const detectionRoutes = require('./routes/detection');
const reportRoutes = require('./routes/report');
const versionRoutes = require('./routes/version');

app.use('/api/tracking', trackingRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/detection', detectionRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/version', versionRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/stats', async (req, res) => {
  const [totalEvents, totalSessions, totalMissing, activePoints] = await Promise.all([
    prisma.pageEvent.count(),
    prisma.debugSession.count(),
    prisma.missingDetection.count(),
    prisma.trackingPoint.count({ where: { status: 'active' } })
  ]);

  res.json({
    totalEvents,
    totalSessions,
    totalMissing,
    activePoints
  });
});

app.listen(PORT, () => {
  console.log(`🚀 埋点验收台后端服务启动于 http://localhost:${PORT}`);
});

module.exports = { prisma };
