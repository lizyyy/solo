import express from 'express';
import { Database } from './database/Database';
import { createShiftSwapRoutes } from './routes/shiftSwapRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function startServer() {
  try {
    const db = await Database.getInstance();
    console.log('数据库连接成功');

    app.use('/api/shift-swaps', createShiftSwapRoutes(db));

    app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '接口不存在',
          nextAction: '请检查URL是否正确'
        }
      });
    });

    app.listen(PORT, () => {
      console.log(`服务器启动成功，运行在 http://localhost:${PORT}`);
      console.log('\n=== API 文档 ===');
      console.log('GET  /api/shift-swaps              - 获取换班记录列表');
      console.log('POST /api/shift-swaps              - 创建换班申请');
      console.log('GET  /api/shift-swaps/:id          - 获取换班详情');
      console.log('GET  /api/shift-swaps/:id/history  - 获取换班历史记录');
      console.log('PATCH /api/shift-swaps/:id/confirm - 确认换班');
      console.log('PATCH /api/shift-swaps/:id/complete - 标记换班完成');
      console.log('GET  /api/shift-swaps/export       - 导出换班记录');
      console.log('POST /api/shift-swaps/validate-import - 验证导入数据');
      console.log('\n=== 状态说明 ===');
      console.log('pending_confirm    - 待确认');
      console.log('swapped            - 已换班');
      console.log('conflict_pending   - 冲突待判');
      console.log('completed          - 已完成');
      console.log('\n=== 启动命令 ===');
      console.log('npm run seed    - 初始化种子数据');
      console.log('npm run dev     - 启动开发服务器');
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();
