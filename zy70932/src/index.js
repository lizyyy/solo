const express = require('express');
const { init } = require('./db');

init();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    service: '装修监理后端服务',
    version: '1.0.0',
    endpoints: {
      'POST /api/batches': '新增批次（导入节点CSV、照片JSON、整改单）',
      'POST /api/records/:id/process': '标记处理（放行）',
      'POST /api/records/:id/return': '退回修改',
      'POST /api/records/:id/exception': '记录异常（缺照片/返工复验/逾期扣款）',
      'POST /api/records/:id/rectification': '新增整改（自动累加整改次数，自动追溯来源）',
      'GET /api/records/:id': '查看记录详情（含审计日志、异常、整改链）',
      'GET /api/history': '查询历史（按工地节点/监理签字/整改次数过滤）',
      'GET /api/history/export': '导出明细（数量与查询结果一致）',
      'GET /api/history/:id/trace': '整改追溯链（追来源）'
    }
  });
});

app.use('/api/batches', require('./routes/batch'));
app.use('/api/records', require('./routes/record'));
app.use('/api/history', require('./routes/history'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`装修监理后端服务已启动: http://localhost:${PORT}`);
});