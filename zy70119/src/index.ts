import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

import './database';

import channelsRoutes from './routes/channels';
import inventoryRoutes from './routes/inventory';
import menuVersionRoutes from './routes/menuVersions';
import recoveryRoutes from './routes/recovery';
import reconciliationRoutes from './routes/reconciliation';
import historyRoutes from './routes/history';

import recoveryTaskService from './services/recoveryTaskService';
import reconciliationService from './services/reconciliationService';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: '门店菜单渠道上下架管理系统',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    服务名称: '门店菜单渠道上下架管理系统',
    版本: '1.0.0',
    功能说明: {
      菜单版本管理: '创建和切换菜单版本，支持商品清单快照',
      门店库存管理: '维护库存数量和预警阈值，缺货自动下架',
      渠道发布管理: '各渠道独立上下架，人工/系统双模式',
      恢复任务: '定时自动恢复上架，支持提前取消',
      发布对账: '检查库存与渠道状态一致性，支持自动修复',
      历史查询: '完整操作记录，人工修正不影响历史追溯'
    },
    可用API: {
      'GET /api/channels': '渠道列表',
      'GET /api/channels/stores': '门店列表',
      'GET /api/channels/items': '商品列表',
      'GET /api/channels/status': '渠道状态查询',
      'POST /api/channels/status/online': '人工上架',
      'POST /api/channels/status/offline': '人工下架',
      'GET /api/inventory': '库存列表',
      'POST /api/inventory/set': '设置库存（触发自动下架）',
      'GET /api/inventory/stockout': '缺货列表',
      'GET /api/menu-versions': '菜单版本列表',
      'POST /api/menu-versions': '创建菜单版本',
      'GET /api/menu-versions/active': '当前活跃版本',
      'GET /api/recovery': '恢复任务列表',
      'POST /api/recovery': '创建恢复任务',
      'POST /api/recovery/:id/execute': '立即执行恢复任务',
      'POST /api/recovery/:id/cancel': '取消恢复任务',
      'POST /api/reconciliation/run': '执行对账',
      'GET /api/reconciliation/history': '对账历史',
      'GET /api/history': '状态变更历史查询'
    }
  });
});

app.use('/api/channels', channelsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/menu-versions', menuVersionRoutes);
app.use('/api/recovery', recoveryRoutes);
app.use('/api/reconciliation', reconciliationRoutes);
app.use('/api/history', historyRoutes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API错误:', err);
  res.status(500).json({
    success: false,
    code: 'ERR-SERVER-001',
    message: `服务器内部错误：${err.message}`,
    timestamp: new Date().toISOString()
  });
});

let scheduledRecovery: any = null;
let scheduledReconciliation: any = null;

const startScheduledTasks = () => {
  scheduledRecovery = setInterval(() => {
    try {
      recoveryTaskService.executeDueTasks();
    } catch (e: any) {
      console.error('执行恢复任务失败:', e.message);
    }
  }, 60 * 1000);

  scheduledReconciliation = setInterval(() => {
    try {
      reconciliationService.runReconciliation(undefined, undefined, false, '系统-定时对账');
    } catch (e: any) {
      console.error('执行定时对账失败:', e.message);
    }
  }, 10 * 60 * 1000);
};

const stopScheduledTasks = () => {
  if (scheduledRecovery) clearInterval(scheduledRecovery);
  if (scheduledReconciliation) clearInterval(scheduledReconciliation);
};

process.on('SIGTERM', () => {
  console.log('收到SIGTERM，停止定时任务...');
  stopScheduledTasks();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('收到SIGINT，停止定时任务...');
  stopScheduledTasks();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  门店菜单渠道上下架管理系统已启动`);
  console.log(`  服务端口: ${PORT}`);
  console.log(`  访问地址: http://localhost:${PORT}`);
  console.log(`  健康检查: http://localhost:${PORT}/health`);
  console.log(`========================================\n`);
  
  startScheduledTasks();
  console.log('[定时任务] 恢复任务检查：每分钟执行一次');
  console.log('[定时任务] 对账检查：每10分钟执行一次（不自动修复）\n');
});

export default app;
