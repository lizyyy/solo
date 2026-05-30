const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const path = require('path');
const { initDatabase, getDb } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/audio', express.static(path.join(__dirname, 'data/audio')));

initDatabase().then(() => {
  const questionRoutes = require('./routes/questions');
  const answerRoutes = require('./routes/answers');
  const errorRoutes = require('./routes/errors');
  const historyRoutes = require('./routes/history');
  const correctionRoutes = require('./routes/corrections');
  const anomalyRoutes = require('./routes/anomalies');

  app.use('/api/questions', questionRoutes);
  app.use('/api/answers', answerRoutes);
  app.use('/api/errors', errorRoutes);
  app.use('/api/history', historyRoutes);
  app.use('/api/corrections', correctionRoutes);
  app.use('/api/anomalies', anomalyRoutes);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  听辨题库错题本系统已启动`);
    console.log(`  访问地址: http://localhost:${PORT}`);
    console.log(`  数据库: ${path.join(__dirname, 'data/database.sqlite')}`);
    console.log(`========================================\n`);
  });
}).catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});
