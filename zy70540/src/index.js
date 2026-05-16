const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('./database');
const vendorsRouter = require('./routes/vendors');
const failuresRouter = require('./routes/failures');
const disposalRouter = require('./routes/disposal');
const healthRouter = require('./routes/health');
const exportRouter = require('./routes/export');
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.get('/', (req, res) => {
 res.json({
 message: '外部依赖健康评分API',
 version: '1.0.0',
 endpoints: {
 vendors: '/api/vendors',
 failures: '/api/failures',
 disposal: '/api/disposal',
 health: '/api/health',
 export: '/api/export'
 }
 });
});
app.use('/api/vendors', vendorsRouter);
app.use('/api/failures', failuresRouter);
app.use('/api/disposal', disposalRouter);
app.use('/api/health', healthRouter);
app.use('/api/export', exportRouter);
app.use((err, req, res, next) => {
 console.error(err.stack);
 res.status(500).json({ success: false, error: '服务器内部错误' });
});
app.listen(PORT, () => {
 console.log(`外部依赖健康评分API服务已启动，监听端口: ${PORT}`);
 console.log(`API文档: http://localhost:${PORT}/`);
});
module.exports = app;
