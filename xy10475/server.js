require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./src/routes/auth');
const outboundRoutes = require('./src/routes/outbound');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/outbound', outboundRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`Outbound Verification API Server`);
  console.log(`========================================`);
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`\nDefault users:`);
  console.log(`  admin / admin123 (role: admin)`);
  console.log(`  checker01 / checker123 (role: checker)`);
  console.log(`\nAPI Endpoints:`);
  console.log(`  POST /api/auth/login`);
  console.log(`  POST /api/outbound/orders`);
  console.log(`  POST /api/outbound/orders/:id/items`);
  console.log(`  GET  /api/outbound/orders`);
  console.log(`  GET  /api/outbound/orders/:id`);
  console.log(`  POST /api/outbound/orders/:id/scan`);
  console.log(`  POST /api/outbound/orders/:id/confirm`);
  console.log(`  POST /api/outbound/orders/:id/cancel`);
  console.log(`  GET  /api/outbound/stats/checker-errors`);
  console.log(`  GET  /api/outbound/stats/checker-errors/:checkerId`);
  console.log(`\n========================================\n`);
});
