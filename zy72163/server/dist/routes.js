"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const database_1 = __importDefault(require("./database"));
const locationService_1 = require("./services/locationService");
const feedbackService_1 = require("./services/feedbackService");
const planService_1 = require("./services/planService");
const conflictService_1 = require("./services/conflictService");
const router = express_1.default.Router();
const upload = (0, multer_1.default)({ dest: 'uploads/' });
router.get('/health', (req, res) => {
    res.json({ status: 'ok', message: '城市树木修剪排程 API 服务正常' });
});
router.get('/dashboard/stats', (req, res) => {
    const totalLocations = database_1.default.locations.all().length;
    const totalFeedbacks = database_1.default.resident_feedbacks.all().length;
    const pendingFeedbacks = database_1.default.resident_feedbacks.filter((f) => f.status === 'pending').length;
    const totalPlans = database_1.default.plan_versions.all().length;
    const draftPlans = database_1.default.plan_versions.filter((p) => p.status === 'draft').length;
    const totalReports = database_1.default.reports.all().length;
    const unresolvedConflicts = database_1.default.data_conflicts.filter((c) => !c.resolvedAt).length;
    const priorityStats = {
        urgent: database_1.default.resident_feedbacks.filter((f) => f.priority === 'urgent').length,
        high: database_1.default.resident_feedbacks.filter((f) => f.priority === 'high').length,
        medium: database_1.default.resident_feedbacks.filter((f) => f.priority === 'medium').length,
        low: database_1.default.resident_feedbacks.filter((f) => f.priority === 'low').length
    };
    const statusStats = {
        pending: database_1.default.resident_feedbacks.filter((f) => f.status === 'pending').length,
        processing: database_1.default.resident_feedbacks.filter((f) => f.status === 'in_progress' || f.status === 'processing').length,
        resolved: database_1.default.resident_feedbacks.filter((f) => f.status === 'resolved').length,
        closed: database_1.default.resident_feedbacks.filter((f) => f.status === 'closed').length
    };
    res.json({
        totalLocations,
        totalFeedbacks,
        pendingFeedbacks,
        totalPlans,
        draftPlans,
        totalReports,
        unresolvedConflicts,
        byPriority: [
            { priority: 'urgent', count: priorityStats.urgent },
            { priority: 'high', count: priorityStats.high },
            { priority: 'medium', count: priorityStats.medium },
            { priority: 'low', count: priorityStats.low }
        ],
        byStatus: [
            { status: 'pending', count: statusStats.pending },
            { status: 'processing', count: statusStats.processing },
            { status: 'resolved', count: statusStats.resolved },
            { status: 'closed', count: statusStats.closed }
        ]
    });
});
router.get('/locations', (req, res) => {
    const locations = (0, locationService_1.getAllLocations)();
    const result = locations.map(loc => ({
        ...loc,
        aliases: (0, locationService_1.getLocationAliases)(loc.id),
        feedbackCount: database_1.default.resident_feedbacks.filter((f) => f.locationId === loc.id).length
    }));
    res.json(result);
});
router.get('/locations/search', (req, res) => {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
        return res.json([]);
    }
    const results = (0, locationService_1.searchLocations)(q);
    res.json(results);
});
router.get('/locations/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const location = (0, locationService_1.getLocationById)(id);
    if (!location) {
        return res.status(404).json({ error: '点位不存在' });
    }
    const aliases = (0, locationService_1.getLocationAliases)(id);
    const feedbacks = (0, feedbackService_1.getFeedbacksByLocation)(id);
    const plans = (0, planService_1.getPlansByLocation)(id);
    const reports = (0, planService_1.getReportsByLocation)(id);
    const timeline = (0, planService_1.getFullLocationTimeline)(id);
    const conflicts = (0, conflictService_1.getConflicts)({ locationId: id, resolved: false });
    res.json({
        location,
        aliases,
        feedbacks,
        plans,
        reports,
        timeline,
        conflicts
    });
});
router.put('/locations/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const updated = (0, locationService_1.updateLocation)(id, req.body);
    if (!updated) {
        return res.status(404).json({ error: '点位不存在' });
    }
    res.json(updated);
});
router.post('/locations/merge', (req, res) => {
    const { targetId, sourceIds } = req.body;
    if (!targetId || !sourceIds || !Array.isArray(sourceIds)) {
        return res.status(400).json({ error: '参数错误' });
    }
    const merged = (0, locationService_1.mergeLocations)(targetId, sourceIds);
    res.json({ merged });
});
router.get('/feedbacks', (req, res) => {
    const { status, priority, locationId } = req.query;
    const filters = {};
    if (status)
        filters.status = status;
    if (priority)
        filters.priority = priority;
    if (locationId)
        filters.locationId = parseInt(locationId);
    const feedbacks = (0, feedbackService_1.getAllFeedbacks)(filters);
    const result = feedbacks.map(fb => ({
        ...fb,
        location: (0, locationService_1.getLocationById)(fb.locationId)
    }));
    res.json(result);
});
router.get('/feedbacks/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const feedback = (0, feedbackService_1.getFeedbackById)(id);
    if (!feedback) {
        return res.status(404).json({ error: '反馈不存在' });
    }
    const location = (0, locationService_1.getLocationById)(feedback.locationId);
    res.json({ feedback, location });
});
router.post('/feedbacks', (req, res) => {
    const { locationName, lat, lng, address, street, district, ...feedbackData } = req.body;
    if (!locationName && (!lat || !lng)) {
        return res.status(400).json({ error: '必须提供位置名称或经纬度' });
    }
    const { location } = (0, locationService_1.findOrCreateLocation)(locationName || address || '未知位置', lat || 31.2304, lng || 121.4737, address, street, district);
    const feedback = (0, feedbackService_1.createFeedback)({
        ...feedbackData,
        locationId: location.id,
        content: feedbackData.content || feedbackData.rawContent,
        rawContent: feedbackData.rawContent || feedbackData.content,
        feedbackDate: feedbackData.feedbackDate || new Date().toISOString().split('T')[0],
        source: feedbackData.source || '居民反馈'
    });
    const conflicts = (0, conflictService_1.checkAndCreateConflicts)(feedback.id);
    res.json({ feedback, location, conflicts });
});
router.post('/feedbacks/batch', (req, res, next) => {
    const contentType = req.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
        next();
    }
    else {
        upload.single('file')(req, res, next);
    }
}, async (req, res) => {
    let feedbacks = [];
    if (req.body.feedbacks && Array.isArray(req.body.feedbacks)) {
        feedbacks = req.body.feedbacks;
    }
    else if (req.file) {
        try {
            const content = await Promise.resolve().then(() => __importStar(require('fs'))).then(fs => fs.promises.readFile(req.file.path, 'utf-8'));
            feedbacks = JSON.parse(content);
        }
        catch (e) {
            return res.status(400).json({ error: '文件解析失败' });
        }
    }
    else {
        return res.status(400).json({ error: '请提供反馈数据或上传文件' });
    }
    const result = (0, feedbackService_1.bulkImportFeedbacks)(feedbacks, locationService_1.findOrCreateLocation);
    res.json(result);
});
router.put('/feedbacks/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const updated = (0, feedbackService_1.updateFeedback)(id, req.body);
    if (!updated) {
        return res.status(404).json({ error: '反馈不存在' });
    }
    res.json(updated);
});
router.delete('/feedbacks/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const deleted = (0, feedbackService_1.deleteFeedback)(id);
    if (!deleted) {
        return res.status(404).json({ error: '反馈不存在' });
    }
    res.json({ success: true });
});
router.get('/plans', (req, res) => {
    const { status, locationId } = req.query;
    const filters = {};
    if (status)
        filters.status = status;
    if (locationId)
        filters.locationId = parseInt(locationId);
    const plans = (0, planService_1.getAllPlans)(filters);
    const result = plans.map(plan => ({
        ...plan,
        location: (0, locationService_1.getLocationById)(plan.locationId)
    }));
    res.json(result);
});
router.get('/plans/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const plan = (0, planService_1.getPlanById)(id);
    if (!plan) {
        return res.status(404).json({ error: '方案不存在' });
    }
    const location = (0, locationService_1.getLocationById)(plan.locationId);
    const reports = (0, planService_1.getReportsByPlan)(id);
    res.json({ plan, location, reports });
});
router.post('/plans', (req, res) => {
    try {
        const plan = (0, planService_1.createPlanVersion)({
            ...req.body,
            createdBy: req.body.createdBy || '系统'
        });
        res.json(plan);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
router.put('/plans/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const updated = (0, planService_1.updatePlan)(id, req.body);
    if (!updated) {
        return res.status(404).json({ error: '方案不存在' });
    }
    res.json(updated);
});
router.post('/plans/:id/report', (req, res) => {
    const id = parseInt(req.params.id);
    const { generatedBy, customContent } = req.body;
    try {
        const report = (0, planService_1.createReportFromPlan)(id, generatedBy || '系统', customContent);
        res.json(report);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
router.get('/reports/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const report = (0, planService_1.getReportById)(id);
    if (!report) {
        return res.status(404).json({ error: '报告不存在' });
    }
    const plan = (0, planService_1.getPlanById)(report.planVersionId);
    const location = (0, locationService_1.getLocationById)(report.locationId);
    res.json({ report, plan, location });
});
router.put('/reports/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const updated = (0, planService_1.updateReport)(id, req.body);
    if (!updated) {
        return res.status(404).json({ error: '报告不存在' });
    }
    res.json(updated);
});
router.get('/conflicts', (req, res) => {
    const { locationId, resolved } = req.query;
    const filters = {};
    if (locationId)
        filters.locationId = parseInt(locationId);
    if (resolved !== undefined)
        filters.resolved = resolved === 'true';
    const conflicts = (0, conflictService_1.getConflicts)(filters);
    const result = conflicts.map(conflict => ({
        ...conflict,
        location: (0, locationService_1.getLocationById)(conflict.locationId),
        feedback: conflict.feedbackId ? database_1.default.resident_feedbacks.get(conflict.feedbackId) : null
    }));
    res.json(result);
});
router.get('/conflicts/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const detail = (0, conflictService_1.getConflictDetail)(id);
    if (!detail) {
        return res.status(404).json({ error: '冲突不存在' });
    }
    res.json(detail);
});
router.post('/conflicts/:id/resolve', (req, res) => {
    const id = parseInt(req.params.id);
    const { resolution, resolvedBy, notes } = req.body;
    if (!['use_feedback', 'use_existing', 'manual'].includes(resolution)) {
        return res.status(400).json({ error: '无效的解决方式' });
    }
    const resolved = (0, conflictService_1.resolveConflict)(id, resolution, resolvedBy || '系统', notes);
    if (!resolved) {
        return res.status(404).json({ error: '冲突不存在' });
    }
    res.json(resolved);
});
router.get('/photos', (req, res) => {
    const { locationId } = req.query;
    let photos = database_1.default.inspection_photos.all();
    if (locationId) {
        photos = photos.filter((p) => p.locationId === parseInt(locationId));
    }
    res.json(photos);
});
router.post('/photos', upload.single('photo'), (req, res) => {
    const { locationId, takenBy, notes, takenDate } = req.body;
    const filePath = req.file?.path;
    if (!locationId || !filePath) {
        return res.status(400).json({ error: '参数错误' });
    }
    const result = database_1.default.inspection_photos.insert({
        locationId: parseInt(locationId),
        filePath,
        fileName: req.file?.originalname,
        takenBy: takenBy || null,
        takenDate: takenDate || new Date().toISOString().split('T')[0],
        notes: notes || null
    });
    const photo = database_1.default.inspection_photos.get(result.lastInsertRowid);
    res.json(photo);
});
router.get('/street-notes', (req, res) => {
    const { locationId } = req.query;
    let notes = database_1.default.street_notes.all();
    if (locationId) {
        notes = notes.filter((n) => n.locationId === parseInt(locationId));
    }
    notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(notes);
});
router.post('/street-notes', (req, res) => {
    const { locationId, streetName, content, author, source } = req.body;
    if (!locationId || !content) {
        return res.status(400).json({ error: '参数错误' });
    }
    const result = database_1.default.street_notes.insert({
        locationId: parseInt(locationId),
        streetName: streetName || null,
        content,
        author: author || null,
        source: source || '街道备注'
    });
    const note = database_1.default.street_notes.get(result.lastInsertRowid);
    res.json(note);
});
exports.default = router;
