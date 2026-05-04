const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./src/routes');
const { initDatabase } = require('./src/config/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '疫苗接种点核对系统运行正常' });
});

async function startServer() {
  try {
    await initDatabase();
    console.log('数据库初始化完成');
    
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log('API 文档:');
      console.log('  GET  /health                  - 健康检查');
      console.log('  POST /api/import/containers   - 导入箱体数据 (CSV)');
      console.log('  POST /api/import/batches      - 导入预约批次 (CSV)');
      console.log('  POST /api/import/temperature  - 导入温度记录 (CSV)');
      console.log('  POST /api/import/calibration  - 导入设备校准 (JSON)');
      console.log('  GET  /api/risks                - 查询风险清单');
      console.log('  POST /api/risks/:id/review    - 护士长改判复核意见');
      console.log('  GET  /api/export/markdown     - 导出 Markdown 放行单');
      console.log('  GET  /api/export/json         - 导出 JSON 审计包');
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

startServer();
