"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const joi_1 = __importDefault(require("joi"));
const json2csv_1 = require("json2csv");
const service_1 = require("./service");
const types_1 = require("./types");
const router = (0, express_1.Router)();
const createRebindSchema = joi_1.default.object({
    device_code: joi_1.default.string().required(),
    old_store_id: joi_1.default.string().required(),
    old_store_name: joi_1.default.string().optional(),
    new_store_id: joi_1.default.string().required(),
    new_store_name: joi_1.default.string().optional(),
    repair_order_id: joi_1.default.string().optional(),
    rebind_reason: joi_1.default.string().required(),
    rebind_report: joi_1.default.string().optional(),
    created_by: joi_1.default.string().optional()
});
const transitionStatusSchema = joi_1.default.object({
    rebind_id: joi_1.default.string().required(),
    target_status: joi_1.default.string().valid(...Object.values(types_1.RebindStatus)).required(),
    operated_by: joi_1.default.string().optional(),
    remark: joi_1.default.string().optional(),
    processing_evidence: joi_1.default.string().optional()
});
const handleExceptionSchema = joi_1.default.object({
    rebind_id: joi_1.default.string().required(),
    exception_reason: joi_1.default.string().required(),
    operated_by: joi_1.default.string().required()
});
const manualFixSchema = joi_1.default.object({
    rebind_id: joi_1.default.string().required(),
    device_code: joi_1.default.string().optional(),
    old_store_id: joi_1.default.string().optional(),
    old_store_name: joi_1.default.string().optional(),
    new_store_id: joi_1.default.string().optional(),
    new_store_name: joi_1.default.string().optional(),
    repair_order_id: joi_1.default.string().optional(),
    rebind_reason: joi_1.default.string().optional(),
    rebind_report: joi_1.default.string().optional(),
    operated_by: joi_1.default.string().required(),
    fix_remark: joi_1.default.string().required()
});
router.post('/create', async (req, res) => {
    try {
        const { error, value } = createRebindSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: error.details[0].message });
        }
        const result = await service_1.deviceRebindService.createRebind(value);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await service_1.deviceRebindService.getRebindById(id);
        if (!result) {
            return res.status(404).json({ success: false, message: '换绑记录不存在' });
        }
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
router.post('/query', async (req, res) => {
    try {
        const result = await service_1.deviceRebindService.queryRebinds(req.body);
        res.json({ success: true, data: result.list, total: result.total });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
router.post('/transition-status', async (req, res) => {
    try {
        const { error, value } = transitionStatusSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: error.details[0].message });
        }
        const result = await service_1.deviceRebindService.transitionStatus(value);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});
router.post('/handle-exception', async (req, res) => {
    try {
        const { error, value } = handleExceptionSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: error.details[0].message });
        }
        const result = await service_1.deviceRebindService.handleException(value.rebind_id, value.exception_reason, value.operated_by);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});
router.post('/manual-fix', async (req, res) => {
    try {
        const { error, value } = manualFixSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: error.details[0].message });
        }
        const result = await service_1.deviceRebindService.manualFix(value);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});
router.post('/export', async (req, res) => {
    try {
        const data = await service_1.deviceRebindService.exportRebinds(req.body);
        if (req.query.format === 'csv') {
            const fields = [
                'id', 'device_code', 'old_store_id', 'old_store_name',
                'new_store_id', 'new_store_name', 'repair_order_id',
                'rebind_reason', 'status', 'warranty_valid',
                'created_by', 'created_at', 'approved_at'
            ];
            const json2csvParser = new json2csv_1.Parser({ fields });
            const csv = json2csvParser.parse(data);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="device_rebind.csv"');
            res.send(csv);
        }
        else {
            res.json({ success: true, data });
        }
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
router.get('/history/device/:deviceCode', async (req, res) => {
    try {
        const { deviceCode } = req.params;
        const result = await service_1.deviceRebindService.getDeviceHistory(deviceCode);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
router.get('/history/rebind/:rebindId', async (req, res) => {
    try {
        const { rebindId } = req.params;
        const result = await service_1.deviceRebindService.getRebindHistory(rebindId);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
exports.default = router;
