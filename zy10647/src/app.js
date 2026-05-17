const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const recoveryRoutes = require('./routes/recovery');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/recovery', recoveryRoutes);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: '补考资格恢复服务运行正常' });
});

app.listen(PORT, () => {
    console.log(`服务器已启动，运行在 http://localhost:${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/api/health`);
    console.log(`API文档:
- POST /api/recovery/create - 创建申请
- POST /api/recovery/submit/:id - 提交申请
- POST /api/recovery/withdraw/:id - 撤回申请
- POST /api/recovery/review/:id - 审核申请
- GET /api/recovery/list - 获取申请列表
- GET /api/recovery/detail/:id - 获取申请详情
- GET /api/recovery/logs/:id - 获取操作日志
- POST /api/recovery/import - 批量导入
- GET /api/recovery/import-errors/:batchNo - 获取导入错误
- GET /api/recovery/export - 导出CSV`);
});
