const express = require('express');
const path = require('path');
const inspectionRoutes = require('./routes/inspectionRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/inspections', inspectionRoutes);

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: '园艺养护巡检系统运行正常',
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.json({
        name: '园艺养护队巡检管理系统',
        version: '1.0.0',
        description: '提供园艺养护巡检记录的导入、查询、冲突检测和导出功能',
        endpoints: {
            list: 'GET /api/inspections',
            detail: 'GET /api/inspections/:id',
            history: 'GET /api/inspections/:id/history',
            create: 'POST /api/inspections',
            update: 'PUT /api/inspections/:id',
            export: 'GET /api/inspections/export/report',
            import: 'POST /api/inspections/import/csv'
        }
    });
});

app.listen(PORT, () => {
    console.log(`园艺养护巡检系统已启动，运行在端口 ${PORT}`);
    console.log(`API 文档: http://localhost:${PORT}/`);
});

module.exports = app;
