const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const wardsRouter = require('./routes/wards');
const caregiversRouter = require('./routes/caregivers');
const wardDemandsRouter = require('./routes/wardDemands');
const schedulesRouter = require('./routes/schedules');
const leavesRouter = require('./routes/leaves');
const substitutesRouter = require('./routes/substitutes');
const workHoursRouter = require('./routes/workHours');
const timeLinesRouter = require('./routes/timeLines');
const reportsRouter = require('./routes/reports');

app.use('/api/wards', wardsRouter);
app.use('/api/caregivers', caregiversRouter);
app.use('/api/ward-demands', wardDemandsRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/leaves', leavesRouter);
app.use('/api/substitutes', substitutesRouter);
app.use('/api/work-hours', workHoursRouter);
app.use('/api/timelines', timeLinesRouter);
app.use('/api/reports', reportsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '陪护排班系统API运行正常' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});
