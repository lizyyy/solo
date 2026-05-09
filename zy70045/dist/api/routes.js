"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const shiftService_1 = require("../services/shiftService");
const productionService_1 = require("../services/productionService");
const downtimeService_1 = require("../services/downtimeService");
const snapshotService_1 = require("../services/snapshotService");
const handoverService_1 = require("../services/handoverService");
const revisionService_1 = require("../services/revisionService");
const router = (0, express_1.Router)();
const handleError = (res, error) => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ error: message });
};
router.post('/shifts', (req, res) => {
    try {
        const { lineId, teamId, teamName, startTime } = req.body;
        const shift = shiftService_1.shiftService.startShift({
            lineId,
            teamId,
            teamName,
            startTime: startTime ? new Date(startTime) : undefined,
        });
        res.json(shift);
    }
    catch (error) {
        handleError(res, error);
    }
});
router.post('/shifts/:id/end', (req, res) => {
    try {
        const { endTime } = req.body;
        const shift = shiftService_1.shiftService.endShift(req.params.id, endTime ? new Date(endTime) : undefined);
        res.json(shift);
    }
    catch (error) {
        handleError(res, error);
    }
});
router.get('/shifts/:id', (req, res) => {
    try {
        const shift = shiftService_1.shiftService.getShift(req.params.id);
        if (!shift) {
            res.status(404).json({ error: '班次不存在' });
            return;
        }
        res.json(shift);
    }
    catch (error) {
        handleError(res, error);
    }
});
router.get('/shifts/:id/status', (req, res) => {
    try {
        const status = shiftService_1.shiftService.getShiftStatus(req.params.id);
        res.json(status);
    }
    catch (error) {
        handleError(res, error);
    }
});
router.get('/shifts/:id/history', (req, res) => {
    try {
        const history = shiftService_1.shiftService.getShiftHistory(req.params.id);
        res.json(history);
    }
    catch (error) {
        handleError(res, error);
    }
});
router.post('/productions', (req, res) => {
    try {
        const { shiftId, productId, productName, quantity, createdBy, timestamp } = req.body;
        const record = productionService_1.productionService.addProduction({
            shiftId,
            productId,
            productName,
            quantity,
            createdBy,
            timestamp: timestamp ? new Date(timestamp) : undefined,
        });
        res.json(record);
    }
    catch (error) {
        handleError(res, error);
    }
});
router.post('/productions/:id/confirm', (req, res) => {
    try {
        const record = productionService_1.productionService.confirmProduction(req.params.id);
        res.json(record);
    }
    catch (error) {
        handleError(res, error);
    }
});
router.get('/shifts/:shiftId/productions', (req, res) => {
    try {
        const result = productionService_1.productionService.getShiftProductions(req.params.shiftId);
        res.json(result);
    }
    catch (error) {
        handleError(res, error);
    }
});
router.post('/wastes', (req, res) => {
    try {
        const { shiftId, productId, productName, quantity, reason, createdBy, timestamp } = req.body;
        const record = productionService_1.productionService.addWaste({
            shiftId,
            productId,
            productName,
            quantity,
            reason,
            createdBy,
            timestamp: timestamp ? new Date(timestamp) : undefined,
        });
        res.json(record);
    }
    catch (error) {
        handleError(res, error);
    }
});
router.post('/wastes/:id/confirm', (req, res) => {
    try {
        const record = productionService_1.productionService.confirmWaste(req.params.id);
        res.json(record);
    }
    catch (error) {
        handleError(res, error);
    }
});
router.get('/shifts/:shiftId/wastes', (req, res) => {
    try {
        const result = productionService_1.productionService.getShiftWastes(req.params.shiftId);
        res.json(result);
    }
    catch (error) {
        handleError(res, error);
    }
});
router.post('/downtimes', (req, res) => {
    try {
        const { lineId, startTime, endTime, reason, createdBy } = req.body;
        const record = downtimeService_1.downtimeService.recordDowntime({
            lineId,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            reason,
            createdBy,
        });
        res.json(record);
    }
    catch (error) {
        handleError(res, error);
    }
});
router.post('/downtimes/:id/allocate/:shiftId', (req, res) => {
    try {
        const allocation = downtimeService_1.downtimeService.allocateDowntime(req.params.id, req.params.shiftId);
        res.json(allocation);
    }
    catch (error) {
        handleError(res, error);
    }
});
router.post('/lines/:lineId/auto-allocate', (req, res) => {
    try {
        const results = downtimeService_1.downtimeService.autoAllocateDowntimeForLine(req.params.lineId);
        res.json(results);
    }
    catch (error) {
        handleError(res, error);
    }
});
router.get('/shifts/:shiftId/downtime', (req, res) => {
    try {
        const result = downtimeService_1.downtimeService.getShiftDowntime(req.params.shiftId);
        res.json(result);
    }
    catch (error) {
        handleError(res, error);
    }
});
router.get('/downtimes/:id/allocations', (req, res) => {
    try {
        const result = downtimeService_1.downtimeService.getDowntimeAllocations(req.params.id);
        res.json(result);
    }
    catch (error) {
        handleError(res, error);
    }
});
router.post('/snapshots', (req, res) => {
    try {
        const { shiftId, handoverFrom, handoverTo, isConfirmed } = req.body;
        const snapshot = snapshotService_1.snapshotService.createSnapshot(shiftId, {
            handoverFrom,
            handoverTo,
            isConfirmed,
        });
        res.json(snapshot);
    }
    catch (error) {
        handleError(res, error);
    }
});
router.get('/shifts/:shiftId/snapshots', (req, res) => {
    try {
        const { version } = req.query;
        if (version !== undefined) {
            const snapshot = snapshotService_1.snapshotService.getSnapshot(req.params.shiftId, Number(version));
            if (!snapshot) {
                res.status(404).json({ error: '快照不存在' });
                return;
            }
            res.json(snapshot);
        }
        else {
            const snapshot = snapshotService_1.snapshotService.getSnapshot(req.params.shiftId);
            if (!snapshot) {
                res.status(404).json({ error: '快照不存在' });
                return;
            }
            res.json(snapshot);
        }
    }
    catch (error) {
        handleError(res, error);
    }
});
router.get('/shifts/:shiftId/snapshots/history', (req, res) => {
    try {
        const history = snapshotService_1.snapshotService.getSnapshotHistory(req.params.shiftId);
        res.json(history);
    }
    catch (error) {
        handleError(res, error);
    }
});
router.get('/shifts/:shiftId/summary', (req, res) => {
    try {
        const { version } = req.query;
        const result = snapshotService_1.snapshotService.getShiftSummaryFromSnapshot(req.params.shiftId, version !== undefined ? Number(version) : undefined);
        res.json(result);
    }
    catch (error) {
        handleError(res, error);
    }
});
router.post('/handover/:shiftId/confirm', (req, res) => {
    try {
        const { handoverFrom, handoverTo } = req.body;
        const shift = handoverService_1.handoverService.confirmHandover(req.params.shiftId, {
            handoverFrom,
            handoverTo,
        });
        res.json(shift);
    }
    catch (error) {
        handleError(res, error);
    }
});
router.get('/handover/:shiftId/summary', (req, res) => {
    try {
        const summary = handoverService_1.handoverService.getHandoverSummary(req.params.shiftId);
        res.json(summary);
    }
    catch (error) {
        handleError(res, error);
    }
});
router.get('/reports/daily', (req, res) => {
    try {
        const { date, lineId } = req.query;
        if (!date || !lineId) {
            res.status(400).json({ error: '缺少必要参数: date 和 lineId' });
            return;
        }
        const report = handoverService_1.handoverService.generateDailyReport(String(date), String(lineId));
        res.json(report);
    }
    catch (error) {
        handleError(res, error);
    }
});
router.get('/reports/daily/export', (req, res) => {
    try {
        const { date, lineId, format = 'json' } = req.query;
        if (!date || !lineId) {
            res.status(400).json({ error: '缺少必要参数: date 和 lineId' });
            return;
        }
        if (format === 'csv') {
            const csv = handoverService_1.handoverService.exportDailyReportAsCSV(String(date), String(lineId));
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="daily-report-${date}-${lineId}.csv"`);
            res.send(csv);
        }
        else {
            const json = handoverService_1.handoverService.exportDailyReportAsJSON(String(date), String(lineId));
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.send(json);
        }
    }
    catch (error) {
        handleError(res, error);
    }
});
router.post('/revisions/productions/:id', (req, res) => {
    try {
        const { revisedBy, reason, changes } = req.body;
        const record = revisionService_1.revisionService.reviseProduction(req.params.id, {
            revisedBy,
            reason,
            changes: {
                quantity: changes?.quantity,
                shiftId: changes?.shiftId,
            },
        });
        res.json(record);
    }
    catch (error) {
        handleError(res, error);
    }
});
router.post('/revisions/wastes/:id', (req, res) => {
    try {
        const { revisedBy, reason, changes } = req.body;
        const record = revisionService_1.revisionService.reviseWaste(req.params.id, {
            revisedBy,
            reason,
            changes: {
                quantity: changes?.quantity,
                reason: changes?.reason,
                shiftId: changes?.shiftId,
            },
        });
        res.json(record);
    }
    catch (error) {
        handleError(res, error);
    }
});
router.post('/revisions/downtimes/:id', (req, res) => {
    try {
        const { revisedBy, reason, changes } = req.body;
        const record = revisionService_1.revisionService.reviseDowntime(req.params.id, {
            revisedBy,
            reason,
            changes: {
                startTime: changes?.startTime ? new Date(changes.startTime) : undefined,
                endTime: changes?.endTime ? new Date(changes.endTime) : undefined,
                reason: changes?.reason,
            },
        });
        res.json(record);
    }
    catch (error) {
        handleError(res, error);
    }
});
router.post('/revisions/shifts/:id', (req, res) => {
    try {
        const { revisedBy, reason, changes } = req.body;
        const record = handoverService_1.handoverService.reviseShift(req.params.id, {
            revisedBy,
            reason,
            changes: {
                teamId: changes?.teamId,
                teamName: changes?.teamName,
                startTime: changes?.startTime ? new Date(changes.startTime) : undefined,
                endTime: changes?.endTime ? new Date(changes.endTime) : undefined,
            },
        });
        res.json(record);
    }
    catch (error) {
        handleError(res, error);
    }
});
router.get('/revisions/:targetType/:targetId', (req, res) => {
    try {
        const { targetType, targetId } = req.params;
        const history = revisionService_1.revisionService.getRevisionHistory(targetId, targetType);
        res.json(history);
    }
    catch (error) {
        handleError(res, error);
    }
});
exports.default = router;
//# sourceMappingURL=routes.js.map