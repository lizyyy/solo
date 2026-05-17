const express = require('express');
const router = express.Router();
const recoveryService = require('../services/recoveryService');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { APPLICATION_STATUS_TEXT } = require('../constants/status');

router.post('/create', async (req, res) => {
    try {
        const result = await recoveryService.createApplication(req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, errorMessage: err.message });
    }
});

router.post('/submit/:id', async (req, res) => {
    try {
        const { operatorId, operatorName } = req.body;
        const result = await recoveryService.submitApplication(req.params.id, operatorId, operatorName);
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, errorMessage: err.message });
    }
});

router.post('/withdraw/:id', async (req, res) => {
    try {
        const { operatorId, operatorName, reason } = req.body;
        const result = await recoveryService.withdrawApplication(req.params.id, operatorId, operatorName, reason);
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, errorMessage: err.message });
    }
});

router.post('/review/:id', async (req, res) => {
    try {
        const { isApproved, reviewerId, reviewerName, reviewerRemark } = req.body;
        const result = await recoveryService.reviewApplication(req.params.id, isApproved, reviewerId, reviewerName, reviewerRemark);
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, errorMessage: err.message });
    }
});

router.get('/list', async (req, res) => {
    try {
        const result = await recoveryService.getApplicationList({
            examineeId: req.query.examineeId,
            examId: req.query.examId,
            status: req.query.status ? parseInt(req.query.status) : undefined,
            page: parseInt(req.query.page || 1),
            pageSize: parseInt(req.query.pageSize || 10)
        });
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, errorMessage: err.message });
    }
});

router.get('/detail/:id', async (req, res) => {
    try {
        const result = await recoveryService.getApplicationDetail(req.params.id);
        if (!result) {
            res.json({ success: false, errorMessage: '申请不存在' });
        } else {
            res.json({ success: true, data: result });
        }
    } catch (err) {
        res.status(500).json({ success: false, errorMessage: err.message });
    }
});

router.get('/logs/:id', async (req, res) => {
    try {
        const result = await recoveryService.getOperationLogs(req.params.id);
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, errorMessage: err.message });
    }
});

router.post('/import', async (req, res) => {
    try {
        const { batchNo, dataList } = req.body;
        const result = await recoveryService.importApplications(batchNo, dataList);
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, errorMessage: err.message });
    }
});

router.get('/import-errors/:batchNo', async (req, res) => {
    try {
        const result = await recoveryService.getImportErrors(req.params.batchNo);
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, errorMessage: err.message });
    }
});

router.get('/export', async (req, res) => {
    try {
        const result = await recoveryService.getApplicationList({
            examineeId: req.query.examineeId,
            examId: req.query.examId,
            status: req.query.status ? parseInt(req.query.status) : undefined,
            page: 1,
            pageSize: 10000
        });

        const csvWriter = createCsvWriter({
            path: '/tmp/recovery_applications.csv',
            header: [
                { id: 'application_no', title: '申请编号' },
                { id: 'examinee_no', title: '考生编号' },
                { id: 'examinee_name', title: '考生姓名' },
                { id: 'exam_name', title: '考试名称' },
                { id: 'exam_date', title: '考试日期' },
                { id: 'reason_name', title: '缺考原因' },
                { id: 'reason_detail', title: '详细说明' },
                { id: 'status', title: '状态' },
                { id: 'created_at', title: '创建时间' }
            ]
        });

        const records = result.list.map(item => ({
            ...item,
            status: APPLICATION_STATUS_TEXT[item.status] || '未知'
        }));

        await csvWriter.writeRecords(records);
        res.download('/tmp/recovery_applications.csv', '补考资格恢复申请列表.csv');
    } catch (err) {
        res.status(500).json({ success: false, errorMessage: err.message });
    }
});

module.exports = router;
