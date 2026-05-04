const express = require('express');
const cors = require('cors');
const path = require('path');

const programsRouter = require('./routes/programs');
const materialsRouter = require('./routes/materials');
const authorizationsRouter = require('./routes/authorizations');
const risksRouter = require('./routes/risks');
const reviewsRouter = require('./routes/reviews');
const importRouter = require('./routes/import');
const exportRouter = require('./routes/export');
const riskDetector = require('./services/riskDetector');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/programs', programsRouter);
app.use('/api/materials', materialsRouter);
app.use('/api/authorizations', authorizationsRouter);
app.use('/api/risks', risksRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/import', importRouter);
app.use('/api/export', exportRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/stats', (req, res) => {
  try {
    const programModel = require('./models/programModel');
    const materialModel = require('./models/materialModel');
    const authorizationModel = require('./models/authorizationModel');
    const riskModel = require('./models/riskModel');
    
    const riskStats = riskModel.getStats();
    
    res.json({
      programs: programModel.getAll().length,
      materials: materialModel.getAll().length,
      authorizations: authorizationModel.getAll().length,
      risks: riskStats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use(express.static(path.join(__dirname, '../../frontend/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

setInterval(() => {
  try {
    riskDetector.runAllChecks();
  } catch (error) {
    console.error('Scheduled risk check failed:', error);
  }
}, 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`播客素材授权核验台服务运行在 http://localhost:${PORT}`);
});
