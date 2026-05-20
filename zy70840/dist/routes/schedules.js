"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ScheduleService_1 = __importDefault(require("../services/ScheduleService"));
const dayjs_1 = __importDefault(require("dayjs"));
const request_1 = require("../utils/request");
const router = (0, express_1.Router)();
router.get('/check', async (req, res) => {
    try {
        const venueName = (0, request_1.getQueryString)(req.query.venueName);
        const location = (0, request_1.getQueryString)(req.query.location);
        const startDateStr = (0, request_1.getQueryString)(req.query.startDate);
        const endDateStr = (0, request_1.getQueryString)(req.query.endDate);
        if (!venueName || !location || !startDateStr || !endDateStr) {
            return res.status(400).json({ error: '必填字段不能为空' });
        }
        const result = await ScheduleService_1.default.checkConflict(venueName, location, (0, dayjs_1.default)(startDateStr).toDate(), (0, dayjs_1.default)(endDateStr).toDate());
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/venue', async (req, res) => {
    try {
        const venueName = (0, request_1.getQueryString)(req.query.venueName);
        const location = (0, request_1.getQueryString)(req.query.location);
        const startDateStr = (0, request_1.getQueryString)(req.query.startDate);
        const endDateStr = (0, request_1.getQueryString)(req.query.endDate);
        if (!venueName || !location || !startDateStr || !endDateStr) {
            return res.status(400).json({ error: '必填字段不能为空' });
        }
        const schedules = await ScheduleService_1.default.getSchedulesByVenueAndDate(venueName, location, (0, dayjs_1.default)(startDateStr).toDate(), (0, dayjs_1.default)(endDateStr).toDate());
        res.json(schedules);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/occupy', async (req, res) => {
    try {
        const { applicationId, venueName, location, startDate, endDate } = req.body;
        if (!applicationId || !venueName || !location || !startDate || !endDate) {
            return res.status(400).json({ error: '必填字段不能为空' });
        }
        const schedule = await ScheduleService_1.default.occupySchedule(applicationId, venueName, location, (0, dayjs_1.default)(startDate).toDate(), (0, dayjs_1.default)(endDate).toDate());
        res.json(schedule);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/block', async (req, res) => {
    try {
        const { venueName, location, startDate, endDate, blockedBy, blockedReason } = req.body;
        if (!venueName || !location || !startDate || !endDate || !blockedBy) {
            return res.status(400).json({ error: '必填字段不能为空' });
        }
        const schedule = await ScheduleService_1.default.blockSchedule(venueName, location, (0, dayjs_1.default)(startDate).toDate(), (0, dayjs_1.default)(endDate).toDate(), blockedBy, blockedReason);
        res.json(schedule);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/release/:applicationId', async (req, res) => {
    try {
        const applicationIdParam = Array.isArray(req.params.applicationId) ? req.params.applicationId[0] : req.params.applicationId;
        await ScheduleService_1.default.releaseSchedule(parseInt(applicationIdParam));
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
