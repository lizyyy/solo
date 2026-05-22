"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const TransferService_1 = require("../services/TransferService");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const { cashBoxId, supervisorId, errorNumber, tellerId, status, batchId, startDate, endDate, page = '1', pageSize = '50' } = req.query;
        const filters = {
            cashBoxId: cashBoxId,
            supervisorId: supervisorId,
            errorNumber: errorNumber,
            tellerId: tellerId,
            status: status,
            batchId: batchId,
            startDate: startDate,
            endDate: endDate
        };
        const result = await TransferService_1.transferService.queryRecords(filters, parseInt(page), parseInt(pageSize));
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({ error: '查询记录失败' });
    }
});
router.get('/:recordId', async (req, res) => {
    try {
        const { recordId } = req.params;
        const record = await TransferService_1.transferService.getRecordById(recordId);
        if (!record) {
            return res.status(404).json({ error: '记录不存在' });
        }
        res.status(200).json(record);
    }
    catch (error) {
        res.status(500).json({ error: '获取记录失败' });
    }
});
router.post('/:recordId/process', async (req, res) => {
    try {
        const { recordId } = req.params;
        const { handledBy, comment } = req.body;
        const record = await TransferService_1.transferService.markProcessed(recordId, handledBy, comment);
        if (!record) {
            return res.status(404).json({ error: '记录不存在' });
        }
        res.status(200).json(record);
    }
    catch (error) {
        res.status(500).json({ error: '标记处理失败' });
    }
});
router.post('/:recordId/return', async (req, res) => {
    try {
        const { recordId } = req.params;
        const { handledBy, comment } = req.body;
        const record = await TransferService_1.transferService.returnForCorrection(recordId, handledBy, comment);
        if (!record) {
            return res.status(404).json({ error: '记录不存在' });
        }
        res.status(200).json(record);
    }
    catch (error) {
        res.status(500).json({ error: '退回修改失败' });
    }
});
router.post('/:recordId/approve', async (req, res) => {
    try {
        const { recordId } = req.params;
        const { handledBy, comment } = req.body;
        const record = await TransferService_1.transferService.approveRecord(recordId, handledBy, comment);
        if (!record) {
            return res.status(404).json({ error: '记录不存在' });
        }
        res.status(200).json(record);
    }
    catch (error) {
        res.status(500).json({ error: '审批失败' });
    }
});
router.get('/export/download', async (req, res) => {
    try {
        const { cashBoxId, supervisorId, errorNumber, tellerId, status, batchId, startDate, endDate } = req.query;
        const filters = {
            cashBoxId: cashBoxId,
            supervisorId: supervisorId,
            errorNumber: errorNumber,
            tellerId: tellerId,
            status: status,
            batchId: batchId,
            startDate: startDate,
            endDate: endDate
        };
        const csvBuffer = await TransferService_1.transferService.exportRecords(filters);
        const filename = `transfer_records_${Date.now()}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csvBuffer);
    }
    catch (error) {
        res.status(500).json({ error: '导出失败' });
    }
});
exports.default = router;
