import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import supplierRoutes from './routes/suppliers.js';
import materialRoutes from './routes/materials.js';
import materialBatchRoutes from './routes/materialBatches.js';
import productRoutes from './routes/products.js';
import recipeRoutes from './routes/recipes.js';
import productionRoutes from './routes/production.js';
import customerRoutes from './routes/customers.js';
import orderRoutes from './routes/orders.js';
import dashboardRoutes from './routes/dashboard.js';
import importRoutes from './routes/import.js';
import exportRoutes from './routes/export.js';

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/suppliers', supplierRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/material-batches', materialBatchRoutes);
app.use('/api/products', productRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/import', importRoutes);
app.use('/api/export', exportRoutes);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  if (err.code === 'P2025') {
    return res.status(404).json({ error: '资源未找到', details: err.message });
  }
  if (err.code === 'P2002') {
    return res.status(400).json({ error: '数据重复', details: err.message });
  }
  res.status(500).json({ 
    error: '服务器内部错误', 
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

app.listen(PORT, () => {
  console.log(`🚀 手作工作室管理系统后端服务已启动`);
  console.log(`📡 服务地址: http://localhost:${PORT}`);
  console.log(`📊 API 文档: http://localhost:${PORT}/api/health`);
  console.log(`🕒 启动时间: ${new Date().toLocaleString()}`);
});

export { prisma };
