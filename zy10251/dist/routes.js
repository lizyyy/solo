"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = __importDefault(require("express"));
const service_1 = require("./service");
exports.router = express_1.default.Router();
exports.router.use(express_1.default.json());
exports.router.post('/appointments', async (req, res) => {
    try {
        const result = await service_1.parkingService.createAppointment(req.body);
        if (result.success) {
            res.status(result.duplicate ? 200 : 201).json(result);
        }
        else {
            res.status(400).json(result);
        }
    }
    catch (e) {
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});
exports.router.get('/appointments', async (req, res) => {
    try {
        const result = await service_1.parkingService.getAllAppointments();
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(500).json(result);
        }
    }
    catch (e) {
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});
exports.router.get('/appointments/pending', async (req, res) => {
    try {
        const result = await service_1.parkingService.getPendingAppointments();
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(500).json(result);
        }
    }
    catch (e) {
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});
exports.router.get('/appointments/:id', async (req, res) => {
    try {
        const result = await service_1.parkingService.getAppointment(req.params.id);
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(404).json(result);
        }
    }
    catch (e) {
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});
exports.router.post('/appointments/:id/approve', async (req, res) => {
    try {
        const result = await service_1.parkingService.approveAppointment(req.params.id, req.body);
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(400).json(result);
        }
    }
    catch (e) {
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});
exports.router.post('/appointments/:id/reject', async (req, res) => {
    try {
        const result = await service_1.parkingService.rejectAppointment(req.params.id, req.body);
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(400).json(result);
        }
    }
    catch (e) {
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});
exports.router.post('/appointments/:id/checkin', async (req, res) => {
    try {
        const result = await service_1.parkingService.checkIn(req.params.id, req.body);
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(400).json(result);
        }
    }
    catch (e) {
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});
exports.router.post('/appointments/:id/checkout', async (req, res) => {
    try {
        const result = await service_1.parkingService.checkOut(req.params.id, req.body);
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(400).json(result);
        }
    }
    catch (e) {
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});
exports.router.post('/appointments/:id/cancel', async (req, res) => {
    try {
        const result = await service_1.parkingService.cancelMeeting(req.params.id, req.body);
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(400).json(result);
        }
    }
    catch (e) {
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});
exports.router.get('/appointments/:id/logs', async (req, res) => {
    try {
        const result = await service_1.parkingService.getChangeLogs('appointment', req.params.id);
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(500).json(result);
        }
    }
    catch (e) {
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});
exports.router.get('/authorizations', async (req, res) => {
    try {
        const result = await service_1.parkingService.getAllAuthorizations();
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(500).json(result);
        }
    }
    catch (e) {
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});
exports.router.get('/authorizations/overdue', async (req, res) => {
    try {
        const result = await service_1.parkingService.getOverdueAuthorizations();
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(500).json(result);
        }
    }
    catch (e) {
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});
exports.router.get('/authorizations/:id', async (req, res) => {
    try {
        const result = await service_1.parkingService.getAuthorization(req.params.id);
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(404).json(result);
        }
    }
    catch (e) {
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});
exports.router.post('/authorizations/:id/revoke', async (req, res) => {
    try {
        const result = await service_1.parkingService.revokeAuthorization(req.params.id, req.body);
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(400).json(result);
        }
    }
    catch (e) {
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});
exports.router.get('/authorizations/:id/logs', async (req, res) => {
    try {
        const result = await service_1.parkingService.getChangeLogs('authorization', req.params.id);
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(500).json(result);
        }
    }
    catch (e) {
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});
exports.default = exports.router;
