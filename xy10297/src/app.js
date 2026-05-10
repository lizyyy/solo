const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./database');
const services = require('./services');
const { v4: uuidv4 } = require('uuid');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    console.log(`[DEBUG] ${req.method} ${req.path}`);
    next();
});

app.post('/api/weighing', async (req, res, next) => {
    try {
        const record = await services.createWeighingRecord(req.body);
        res.status(201).json({
            success: true,
            data: record,
            message: '称重记录创建成功'
        });
    } catch (err) {
        next(err);
    }
});

app.get('/api/weighing/:id', async (req, res, next) => {
    try {
        const record = await services.getWeighingRecord(req.params.id);
        if (!record) {
            return res.status(404).json({
                success: false,
                message: '称重记录不存在'
            });
        }
        res.json({
            success: true,
            data: record
        });
    } catch (err) {
        next(err);
    }
});

app.post('/api/reprint', async (req, res, next) => {
    try {
        const request = await services.createReprintRequest(req.body);
        res.status(201).json({
            success: true,
            data: request,
            message: '重打申请创建成功'
        });
    } catch (err) {
        next(err);
    }
});

app.get('/api/reprint/:id', async (req, res, next) => {
    try {
        const request = await services.getReprintRequest(req.params.id);
        if (!request) {
            return res.status(404).json({
                success: false,
                message: '申请不存在'
            });
        }
        res.json({
            success: true,
            data: request
        });
    } catch (err) {
        next(err);
    }
});

app.post('/api/reprint/:id/approve', async (req, res, next) => {
    try {
        const { operator_id } = req.body;
        const result = await services.approveRequest(req.params.id, operator_id);
        res.json({
            success: true,
            data: result,
            message: '申请已批准'
        });
    } catch (err) {
        next(err);
    }
});

app.post('/api/reprint/:id/reject', async (req, res, next) => {
    try {
        const { operator_id, reason } = req.body;
        const result = await services.rejectRequest(req.params.id, operator_id, reason);
        res.json({
            success: true,
            data: result,
            message: '申请已拒绝'
        });
    } catch (err) {
        next(err);
    }
});

app.post('/api/reprint/:id/cancel', async (req, res, next) => {
    try {
        const { operator_id } = req.body;
        const result = await services.cancelRequest(req.params.id, operator_id);
        res.json({
            success: true,
            data: result,
            message: '申请已取消'
        });
    } catch (err) {
        next(err);
    }
});

app.post('/api/reprint/:id/execute', async (req, res, next) => {
    try {
        const { operator_id } = req.body;
        const result = await services.executeReprint(req.params.id, operator_id);
        res.json({
            success: true,
            data: result,
            message: '标签重打成功'
        });
    } catch (err) {
        next(err);
    }
});

app.post('/api/reprint/:id/modify', async (req, res, next) => {
    try {
        const { operator_id, ...modifications } = req.body;
        const result = await services.modifyRequest(req.params.id, operator_id, modifications);
        res.json({
            success: true,
            data: result,
            message: '申请已修改'
        });
    } catch (err) {
        next(err);
    }
});

app.post('/api/batch/lock', async (req, res, next) => {
    try {
        const { batch_number, counter_code, operator_id, reason, expires_at } = req.body;
        const result = await services.lockBatch(batch_number, counter_code, operator_id, reason, expires_at);
        res.json({
            success: true,
            data: result,
            message: '批次已锁定'
        });
    } catch (err) {
        next(err);
    }
});

app.post('/api/batch/unlock', async (req, res, next) => {
    try {
        const { batch_number, counter_code, operator_id } = req.body;
        const result = await services.unlockBatch(batch_number, counter_code, operator_id);
        res.json({
            success: true,
            data: result,
            message: '批次已解锁'
        });
    } catch (err) {
        next(err);
    }
});

app.get('/api/summary', async (req, res, next) => {
    try {
        const summary = await services.getSummary(req.query);
        res.json({
            success: true,
            data: summary
        });
    } catch (err) {
        next(err);
    }
});

app.get('/api/audit', async (req, res, next) => {
    try {
        const logs = await services.getAuditLogs(req.query);
        res.json({
            success: true,
            data: logs
        });
    } catch (err) {
        next(err);
    }
});

app.use((err, req, res, next) => {
    console.error('[ERROR]', err.stack);
    res.status(500).json({
        success: false,
        message: err.message || '服务器内部错误'
    });
});

app.use((req, res) => {
    console.log('[404]', req.method, req.path);
    res.status(404).json({
        success: false,
        message: '接口不存在: ' + req.path
    });
});

const PORT = process.env.PORT || 3001;

const startServer = async () => {
    try {
        await initDatabase();
        console.log('数据库初始化成功');
        
        app.listen(PORT, () => {
            console.log(`生鲜称重标签重打 API 服务启动成功`);
            console.log(`服务地址: http://localhost:${PORT}`);
            console.log(`API 前缀: http://localhost:${PORT}/api`);
        });
    } catch (err) {
        console.error('启动失败:', err);
        process.exit(1);
    }
};

startServer();

module.exports = app;
