const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const busRoutesRouter = require('./routes/busRoutes');
const temporaryStopsRouter = require('./routes/temporaryStops');
const studentStopsRouter = require('./routes/studentStops');
const safetyRouter = require('./routes/safety');
const reportsRouter = require('./routes/reports');

app.use('/api/bus-routes', busRoutesRouter);
app.use('/api/temporary-stops', temporaryStopsRouter);
app.use('/api/student-stops', studentStopsRouter);
app.use('/api/safety', safetyRouter);
app.use('/api/reports', reportsRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`校车临停点 API 服务已启动: http://localhost:${port}`);
  console.log('健康检查: http://localhost:3000/health');
  console.log('API 路径: /api/*');
});