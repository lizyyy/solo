const express = require('express');
const cors = require('cors');
const path = require('path');

const statisticsRouter = require('./routes/statistics');
const mattersRouter = require('./routes/matters');
const identityTypesRouter = require('./routes/identityTypes');
const attachmentsRouter = require('./routes/attachments');
const gapsRouter = require('./routes/gaps');
const exceptionsRouter = require('./routes/exceptions');
const reportRouter = require('./routes/report');
const historyRouter = require('./routes/history');
const correctionOpinionsRouter = require('./routes/correctionOpinions');
const windowAcceptancesRouter = require('./routes/windowAcceptances');
const preReviewRouter = require('./routes/preReview');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

app.use('/api/statistics', statisticsRouter);
app.use('/api/matters', mattersRouter);
app.use('/api/identity-types', identityTypesRouter);
app.use('/api/attachments', attachmentsRouter);
app.use('/api/gaps', gapsRouter);
app.use('/api/exceptions', exceptionsRouter);
app.use('/api/report', reportRouter);
app.use('/api/history', historyRouter);
app.use('/api/correction-opinions', correctionOpinionsRouter);
app.use('/api/window-acceptances', windowAcceptancesRouter);
app.use('/api/pre-review', preReviewRouter);

app.use('/exports', express.static(path.join(__dirname, 'exports')));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '政务材料预审补正系统运行正常' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});
