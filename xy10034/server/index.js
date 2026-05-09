require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const path = require('path');
const IdempotencyChecker = require('./utils/idempotencyChecker');
const db = require('./database/db');
const retryScheduler = require('./services/retryScheduler');

const logsRouter = require('./routes/logs');
const auditRouter = require('./routes/audit');
const reportsRouter = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));
app.use(IdempotencyChecker.middleware);

app.use(express.static(path.join(__dirname, '../public')));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        success: false,
        error: 'RATE_LIMIT',
        message: '请求过于频繁，请稍后再试'
    }
});
app.use(limiter);

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: Date.now(),
        uptime: process.uptime()
    });
});

app.use('/api/logs', logsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/reports', reportsRouter);

app.use((err, req, res, next) => {
    console.error('未处理的错误:', err);
    res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production' 
            ? '服务器内部错误' 
            : err.message
    });
});

app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: '接口不存在'
    });
});

process.on('SIGINT', () => {
    console.log('正在关闭服务器...');
    retryScheduler.stop();
    db.close((err) => {
        if (err) {
            console.error('关闭数据库失败:', err.message);
        } else {
            console.log('数据库连接已关闭');
        }
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('收到 SIGTERM 信号，正在关闭...');
    retryScheduler.stop();
    db.close((err) => {
        if (err) {
            console.error('关闭数据库失败:', err.message);
        }
        process.exit(0);
    });
});

process.on('uncaughtException', (err) => {
    console.error('未捕获的异常:', err);
    retryScheduler.stop();
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的 Promise 拒绝:', reason);
});

app.listen(PORT, () => {
    console.log(`日志分析系统启动成功`);
    console.log(`服务地址: http://localhost:${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/health`);
    
    retryScheduler.start();
});

module.exports = app;
