"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFeedback = createFeedback;
exports.getFeedbackById = getFeedbackById;
exports.getFeedbacksByLocation = getFeedbacksByLocation;
exports.getAllFeedbacks = getAllFeedbacks;
exports.updateFeedback = updateFeedback;
exports.deleteFeedback = deleteFeedback;
exports.bulkImportFeedbacks = bulkImportFeedbacks;
const database_1 = __importDefault(require("../database"));
function createFeedback(data) {
    const result = database_1.default.resident_feedbacks.insert({
        locationId: data.locationId,
        feedbackNo: data.feedbackNo || null,
        reporter: data.reporter || null,
        phone: data.phone || null,
        feedbackDate: data.feedbackDate,
        content: data.content,
        rawContent: data.rawContent,
        source: data.source,
        status: data.status || 'pending',
        priority: data.priority || 'medium',
        assignedTo: data.assignedTo || null
    });
    return database_1.default.resident_feedbacks.get(result.lastInsertRowid);
}
function getFeedbackById(id) {
    return database_1.default.resident_feedbacks.get(id);
}
function getFeedbacksByLocation(locationId) {
    return database_1.default.resident_feedbacks.filter((f) => f.locationId === locationId).sort((a, b) => {
        const dateA = new Date(a.feedbackDate || a.createdAt).getTime();
        const dateB = new Date(b.feedbackDate || b.createdAt).getTime();
        return dateB - dateA;
    });
}
function getAllFeedbacks(filters) {
    let results = database_1.default.resident_feedbacks.all();
    if (filters?.status) {
        results = results.filter((f) => f.status === filters.status);
    }
    if (filters?.priority) {
        results = results.filter((f) => f.priority === filters.priority);
    }
    if (filters?.locationId) {
        results = results.filter((f) => f.locationId === filters.locationId);
    }
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    results.sort((a, b) => {
        const pa = priorityOrder[a.priority] ?? 3;
        const pb = priorityOrder[b.priority] ?? 3;
        if (pa !== pb)
            return pa - pb;
        return new Date(b.feedbackDate || b.createdAt).getTime() - new Date(a.feedbackDate || a.createdAt).getTime();
    });
    return results;
}
function updateFeedback(id, updates) {
    const { id: _, createdAt: __, locationId: ___, ...data } = updates;
    database_1.default.resident_feedbacks.update(id, data);
    return getFeedbackById(id);
}
function deleteFeedback(id) {
    const result = database_1.default.resident_feedbacks.delete(id);
    return result.changes > 0;
}
function bulkImportFeedbacks(feedbacks, findLocation) {
    let imported = 0;
    let skipped = 0;
    const errors = [];
    for (const fb of feedbacks) {
        try {
            if (!fb.locationName && !fb.lat) {
                skipped++;
                errors.push(`反馈缺少位置信息: ${fb.content?.substring(0, 30)}...`);
                continue;
            }
            const lat = fb.lat || 31.2304 + Math.random() * 0.1;
            const lng = fb.lng || 121.4737 + Math.random() * 0.1;
            const { location } = findLocation(fb.locationName || fb.address || '未知位置', lat, lng, fb.address, fb.street, fb.district);
            createFeedback({
                locationId: location.id,
                feedbackNo: fb.feedbackNo,
                reporter: fb.reporter,
                phone: fb.phone,
                feedbackDate: fb.feedbackDate || fb.date || new Date().toISOString().split('T')[0],
                content: fb.content || fb.rawContent || '',
                rawContent: fb.rawContent || fb.content || '',
                source: fb.source || '居民反馈',
                status: fb.status,
                priority: fb.priority,
                assignedTo: fb.assignedTo
            });
            imported++;
        }
        catch (e) {
            skipped++;
            errors.push(`导入失败: ${e.message}`);
        }
    }
    return { imported, skipped, errors };
}
