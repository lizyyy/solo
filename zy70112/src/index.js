const express = require('express');
const { initDb, closeDb } = require('./db/database');
const config = require('./config');

const reportsRouter = require('./routes/reports');
const plotsRouter = require('./routes/plots');
const weatherRouter = require('./routes/weather');
const photosRouter = require('./routes/photos');
const dispatchesRouter = require('./routes/dispatches');
const claimsRouter = require('./routes/claims');
const exportRouter = require('./routes/export');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/config', (req, res) => {
    res.json({
        success: true,
        data: {
            validCropTypes: config.business.validCropTypes,
            validDisasterTypes: config.business.validDisasterTypes,
            reportStatuses: config.business.reportStatuses,
            photoTypes: config.business.photoTypes,
            statusTransitions: config.business.statusTransitions
        }
    });
});

app.use('/api/reports', reportsRouter);
app.use('/api/reports', plotsRouter);
app.use('/api/reports', weatherRouter);
app.use('/api/reports', photosRouter);
app.use('/api/reports', dispatchesRouter);
app.use('/api/reports', claimsRouter);
app.use('/api', exportRouter);

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: '服务器内部错误'
    });
});

process.on('SIGINT', () => {
    console.log('正在关闭服务器...');
    closeDb();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('正在关闭服务器...');
    closeDb();
    process.exit(0);
});

async function startServer() {
    await initDb();
    
    app.listen(config.port, () => {
        console.log(`农险灾损报案 API 服务已启动: http://localhost:${config.port}`);
        console.log(`- 健康检查: http://localhost:${config.port}/health`);
        console.log(`- 配置信息: http://localhost:${config.port}/config`);
    });
}

if (require.main === module) {
    startServer().catch(err => {
        console.error('启动失败:', err);
        process.exit(1);
    });
}

module.exports = { app, startServer };
