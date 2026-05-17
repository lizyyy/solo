"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerReminders = exports.triggerExpirationCheck = exports.updateHitTenants = exports.exportRecycle = exports.manualCorrection = exports.handleException = exports.transitionStatus = exports.queryRecycle = exports.getRecycleById = exports.createRecycle = void 0;
const recycleService_1 = require("../services/recycleService");
const exportService_1 = require("../services/exportService");
const createRecycle = (req, res) => {
    try {
        const request = req.body;
        const record = recycleService_1.recycleService.create(request);
        res.status(201).json(record);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.createRecycle = createRecycle;
const getRecycleById = (req, res) => {
    try {
        const { id } = req.params;
        const record = recycleService_1.recycleService.findById(id);
        if (!record) {
            return res.status(404).json({ error: 'Record not found' });
        }
        res.json(record);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getRecycleById = getRecycleById;
const queryRecycle = (req, res) => {
    try {
        const query = req.query;
        const result = recycleService_1.recycleService.query(query);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.queryRecycle = queryRecycle;
const transitionStatus = (req, res) => {
    try {
        const { id } = req.params;
        const request = req.body;
        const record = recycleService_1.recycleService.transitionStatus(id, request);
        if (!record) {
            return res.status(404).json({ error: 'Record not found' });
        }
        res.json(record);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.transitionStatus = transitionStatus;
const handleException = (req, res) => {
    try {
        const { id, exceptionId } = req.params;
        const request = req.body;
        const record = recycleService_1.recycleService.handleException(id, exceptionId, request);
        if (!record) {
            return res.status(404).json({ error: 'Record or exception not found' });
        }
        res.json(record);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.handleException = handleException;
const manualCorrection = (req, res) => {
    try {
        const { id } = req.params;
        const request = req.body;
        const record = recycleService_1.recycleService.manualCorrection(id, request);
        if (!record) {
            return res.status(404).json({ error: 'Record not found' });
        }
        res.json(record);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.manualCorrection = manualCorrection;
const exportRecycle = (req, res) => {
    try {
        const { type = 'detail' } = req.query;
        const records = recycleService_1.recycleService.getAllForExport();
        let csv;
        let filename;
        if (type === 'statistics') {
            csv = exportService_1.exportService.exportStatistics(records);
            filename = `gray-config-recycle-statistics-${Date.now()}.csv`;
        }
        else {
            csv = exportService_1.exportService.exportToCSV(records);
            filename = `gray-config-recycle-detail-${Date.now()}.csv`;
        }
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send('\uFEFF' + csv);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.exportRecycle = exportRecycle;
const updateHitTenants = (req, res) => {
    try {
        const { id } = req.params;
        const { tenants } = req.body;
        const record = recycleService_1.recycleService.updateHitTenants(id, tenants);
        if (!record) {
            return res.status(404).json({ error: 'Record not found' });
        }
        res.json(record);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.updateHitTenants = updateHitTenants;
const triggerExpirationCheck = (req, res) => {
    try {
        recycleService_1.recycleService.checkExpirations();
        res.json({ message: 'Expiration check completed' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.triggerExpirationCheck = triggerExpirationCheck;
const triggerReminders = (req, res) => {
    try {
        recycleService_1.recycleService.sendReminders();
        res.json({ message: 'Reminders sent' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.triggerReminders = triggerReminders;
