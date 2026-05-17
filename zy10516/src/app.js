const express = require('express');
const trialRoutes = require('./routes/trialRoutes');
const errorRoutes = require('./routes/errorRoutes');
const errorHandler = require('./middleware/errorHandler');
const duplicateProtection = require('./middleware/duplicateProtection');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(duplicateProtection);

app.use('/api/trials', trialRoutes);
app.use('/api/errors', errorRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`阈值试算API服务已启动: http://localhost:${PORT}`);
  console.log('API文档参考: README.md');
});

module.exports = app;