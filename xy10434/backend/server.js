const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const { initDatabase } = require('./database');

async function startServer() {
  await initDatabase();
  require('./models/init')();

  const authRoutes = require('./routes/auth');
  const ownerRoutes = require('./routes/owners');
  const roomRoutes = require('./routes/rooms');
  const decorationRoutes = require('./routes/decorations');
  const depositRoutes = require('./routes/deposits');
  const inspectionRoutes = require('./routes/inspections');
  const refundRoutes = require('./routes/refunds');
  const dashboardRoutes = require('./routes/dashboard');

  app.use('/api/auth', authRoutes);
  app.use('/api/owners', ownerRoutes);
  app.use('/api/rooms', roomRoutes);
  app.use('/api/decorations', decorationRoutes);
  app.use('/api/deposits', depositRoutes);
  app.use('/api/inspections', inspectionRoutes);
  app.use('/api/refunds', refundRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  const PORT = process.env.PORT || 3002;
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('启动服务器失败:', err);
  process.exit(1);
});
