import express from 'express';
import reviewRoutes from './routes/reviewRoutes';
import seed from './seedData';
import { initDb } from './database';

const app = express();
const PORT = 3000;

app.use(express.json());

app.use('/api/review', reviewRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const startServer = async () => {
  console.log('🔧 初始化数据库...');
  await initDb();

  app.listen(PORT, async () => {
    console.log(`🚀 服务启动成功: http://localhost:${PORT}`);
    console.log(`📋 API 文档:`);
    console.log(`   GET  /api/review/fragments          - 违规片段列表`);
    console.log(`   GET  /api/review/fragments/:id      - 违规片段详情`);
    console.log(`   POST /api/review/fragments          - 创建违规片段`);
    console.log(`   PATCH /api/review/fragments/:id/status - 更新状态`);
    console.log(`   GET  /api/review/fragments/:id/history - 操作历史`);
    console.log(`   GET  /api/review/export             - 导出CSV`);
    console.log(`   POST /api/review/import             - 批量导入`);

    console.log('\n🌱 正在初始化种子数据...');
    const seedResult = await seed();
    console.log('✅ 种子数据初始化完成:');
    console.log(`   - 完整流转记录: ${seedResult.fullFlowFragment.id}`);
    console.log(`   - 冲突记录: ${seedResult.conflictFragments.length} 条`);
    console.log(`   - 导入成功: ${seedResult.importResult.successIds.length} 条`);
    console.log(`   - 导入失败: ${seedResult.importResult.failed.length} 条`);
  });
};

startServer().catch(console.error);
