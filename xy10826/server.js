const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDemoData } = require('./services/demoData');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const identityRoutes = require('./routes/identityRoutes');
const mergeRoutes = require('./routes/mergeRoutes');
const auditRoutes = require('./routes/auditRoutes');
const exportRoutes = require('./routes/exportRoutes');

app.use('/api/identities', identityRoutes);
app.use('/api/merges', mergeRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

initDemoData();

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});