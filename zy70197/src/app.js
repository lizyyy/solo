const express = require('express');
const { initDatabase } = require('./database/db');

const agreementsRouter = require('./routes/agreements');
const projectsRouter = require('./routes/projects');
const ordersRouter = require('./routes/orders');
const reportsRouter = require('./routes/reports');

const app = express();

initDatabase();

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/agreements', agreementsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/reports', reportsRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '内部服务器错误' });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`框架协议用量消耗服务已启动，监听端口 ${PORT}`);
  });
}

module.exports = app;
