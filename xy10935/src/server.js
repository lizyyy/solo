const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const { exceptionHandler } = require('./middleware/exceptionHandler');

const studentsRouter = require('./routes/students');
const guardiansRouter = require('./routes/guardians');
const authorizationsRouter = require('./routes/authorizations');
const leavesRouter = require('./routes/leaves');
const pickupsRouter = require('./routes/pickups');
const reportsRouter = require('./routes/reports');
const adminRouter = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    name: '儿童托管接送API',
    version: '1.0.0',
    endpoints: {
      students: '/api/students',
      guardians: '/api/guardians',
      authorizations: '/api/authorizations',
      leaves: '/api/leaves',
      pickups: '/api/pickups',
      reports: '/api/reports',
      admin: '/api/admin'
    }
  });
});

app.use('/api/students', studentsRouter);
app.use('/api/guardians', guardiansRouter);
app.use('/api/authorizations', authorizationsRouter);
app.use('/api/leaves', leavesRouter);
app.use('/api/pickups', pickupsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/admin', adminRouter);

app.use(exceptionHandler);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: '接口不存在',
      path: req.path
    }
  });
});

app.listen(PORT, () => {
  console.log(`儿童托管接送API服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`数据库目录: ${dataDir}`);
});

module.exports = app;
