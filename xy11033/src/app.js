const express = require('express');
const config = require('./config');
const feedingChangeRoutes = require('./routes/feedingChanges');
const businessRuleRoutes = require('./routes/businessRules');
const feedingChangeService = require('./services/feedingChangeService');
const { getAllValidTransitions } = require('./services/stateMachine');
const { initTables } = require('./db');

const app = express();

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.use('/api/feeding-changes', feedingChangeRoutes);
app.use('/api/business-rules', businessRuleRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '宠物寄养喂食变更API服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/overview', async (req, res) => {
  try {
    const allChanges = await feedingChangeService.getFeedingChanges();
    const normalChanges = await feedingChangeService.getNormalRecords();
    const abnormalChanges = await feedingChangeService.getAbnormalRecords();

    const statusStats = {};
    allChanges.forEach(c => {
      statusStats[c.status] = (statusStats[c.status] || 0) + 1;
    });

    const typeStats = {};
    allChanges.forEach(c => {
      typeStats[c.change_type] = (typeStats[c.change_type] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        totalRecords: allChanges.length,
        normalRecords: normalChanges.length,
        abnormalRecords: abnormalChanges.length,
        statusStats,
        typeStats,
        stateTransitions: getAllValidTransitions()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>宠物寄养喂食变更API</title>
        <style>
            body { font-family: 'Microsoft YaHei', sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
            h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
            .card { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .endpoint { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #3498db; }
            .method { display: inline-block; padding: 3px 8px; border-radius: 4px; color: white; font-weight: bold; margin-right: 10px; }
            .GET { background: #27ae60; }
            .POST { background: #2980b9; }
            code { background: #ecf0f1; padding: 2px 6px; border-radius: 3px; }
            .status-badge { display: inline-block; padding: 4px 8px; border-radius: 12px; font-size: 12px; margin: 2px; }
            .normal { background: #d4edda; color: #155724; }
            .abnormal { background: #f8d7da; color: #721c24; }
        </style>
    </head>
    <body>
        <h1>🐾 宠物寄养喂食变更API系统</h1>
        
        <div class="card">
            <h2>📊 系统状态</h2>
            <p>✅ 服务运行正常</p>
            <p>📅 当前时间: ${new Date().toLocaleString('zh-CN')}</p>
            <p>💾 数据库: SQLite (本地文件)</p>
        </div>

        <div class="card">
            <h2>🔗 主要API端点</h2>
            
            <div class="endpoint">
                <span class="method GET">GET</span>
                <code>/api/overview</code> - 系统概览和统计数据
            </div>
            
            <div class="endpoint">
                <span class="method POST">POST</span>
                <code>/api/feeding-changes</code> - 创建喂食变更记录
            </div>
            
            <div class="endpoint">
                <span class="method GET">GET</span>
                <code>/api/feeding-changes</code> - 获取所有变更记录
            </div>
            
            <div class="endpoint">
                <span class="method GET">GET</span>
                <code>/api/feeding-changes/normal</code> - 获取正常记录 <span class="status-badge normal">normal</span>
            </div>
            
            <div class="endpoint">
                <span class="method GET">GET</span>
                <code>/api/feeding-changes/abnormal</code> - 获取异常记录 <span class="status-badge abnormal">abnormal</span>
            </div>
            
            <div class="endpoint">
                <span class="method GET">GET</span>
                <code>/api/feeding-changes/transitions</code> - 获取所有状态流转规则
            </div>
            
            <div class="endpoint">
                <span class="method POST">POST</span>
                <code>/api/feeding-changes/:id/actions</code> - 执行状态变更动作
            </div>
        </div>

        <div class="card">
            <h2>📋 状态流转说明</h2>
            <ul>
                <li><strong>pending_review</strong> → approve/reject/cancel → approved/rejected/cancelled</li>
                <li><strong>approved</strong> → start_execute/cancel → executing/cancelled</li>
                <li><strong>executing</strong> → complete/mark_abnormal → completed/abnormal</li>
                <li><strong>abnormal</strong> → resolve_abnormal/cancel → pending_review/cancelled</li>
            </ul>
        </div>

        <div class="card">
            <h2>⚠️ 冲突检测类型</h2>
            <ul>
                <li><strong>inventory_shortage</strong> - 库存不足冲突</li>
                <li><strong>daily_report_inconsistency</strong> - 护理日报不一致</li>
                <li><strong>duplicate_change_request</strong> - 24小时内重复请求</li>
            </ul>
        </div>
    </body>
    </html>
  `;
  res.send(html);
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '端点不存在',
    availableEndpoints: {
      feedingChanges: '/api/feeding-changes',
      businessRules: '/api/business-rules',
      health: '/api/health',
      overview: '/api/overview'
    }
  });
});

async function startServer() {
  await initTables();
  
  app.listen(config.port, () => {
    console.log('\n' + '='.repeat(60));
    console.log('🐾 宠物寄养喂食变更API系统启动成功');
    console.log('='.repeat(60));
    console.log(`📍 服务地址: http://localhost:${config.port}`);
    console.log(`📊 概览页面: http://localhost:${config.port}/api/overview`);
    console.log(`💾 数据库文件: ${config.dbPath}`);
    console.log('='.repeat(60) + '\n');
  });
}

startServer();

module.exports = app;
