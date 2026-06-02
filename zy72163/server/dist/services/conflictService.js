"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAndCreateConflicts = checkAndCreateConflicts;
exports.getConflicts = getConflicts;
exports.getConflictById = getConflictById;
exports.resolveConflict = resolveConflict;
exports.getConflictDetail = getConflictDetail;
const database_1 = __importDefault(require("../database"));
const utils_1 = require("../utils");
function checkAndCreateConflicts(feedbackId) {
    const feedback = database_1.default.resident_feedbacks.get(feedbackId);
    if (!feedback)
        return [];
    const existingFeedbacks = database_1.default.resident_feedbacks.filter((f) => f.locationId === feedback.locationId && f.id !== feedbackId);
    const conflicts = (0, utils_1.detectConflicts)(feedback, existingFeedbacks);
    const createdConflicts = [];
    for (const conflict of conflicts) {
        const existing = database_1.default.data_conflicts.findOne((c) => c.feedbackId === conflict.feedbackId &&
            c.relatedFeedbackId === conflict.relatedFeedbackId &&
            c.resolvedAt === null);
        if (!existing) {
            const result = database_1.default.data_conflicts.insert({
                locationId: conflict.locationId,
                feedbackId: conflict.feedbackId,
                relatedFeedbackId: conflict.relatedFeedbackId,
                conflictType: conflict.conflictType,
                description: conflict.description,
                feedbackValue: conflict.feedbackValue,
                existingValue: conflict.existingValue,
                suggestedAction: conflict.suggestedAction,
                resolvedAt: null,
                resolvedBy: null,
                resolution: null
            });
            createdConflicts.push(database_1.default.data_conflicts.get(result.lastInsertRowid));
        }
    }
    return createdConflicts;
}
function getConflicts(filters) {
    let results = database_1.default.data_conflicts.all();
    if (filters?.locationId) {
        results = results.filter((c) => c.locationId === filters.locationId);
    }
    if (filters?.resolved !== undefined) {
        if (filters.resolved) {
            results = results.filter((c) => c.resolvedAt !== null);
        }
        else {
            results = results.filter((c) => c.resolvedAt === null);
        }
    }
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return results;
}
function getConflictById(id) {
    return database_1.default.data_conflicts.get(id);
}
function resolveConflict(id, resolution, resolvedBy, notes) {
    const conflict = getConflictById(id);
    if (!conflict)
        return undefined;
    let resolutionNotes = notes || '';
    if (resolution === 'use_feedback') {
        resolutionNotes = notes || `采用新反馈内容: ${conflict.feedbackValue}`;
    }
    else if (resolution === 'use_existing') {
        resolutionNotes = notes || `保留原有内容: ${conflict.existingValue}`;
    }
    database_1.default.data_conflicts.update(id, {
        resolvedAt: new Date().toISOString(),
        resolvedBy,
        resolution: resolutionNotes
    });
    const result = getConflictById(id);
    if (result && resolution === 'use_feedback' && result.feedbackId) {
        database_1.default.resident_feedbacks.update(result.feedbackId, {
            status: 'in_progress'
        });
    }
    return result;
}
function getConflictDetail(conflictId) {
    const conflict = getConflictById(conflictId);
    if (!conflict)
        return null;
    const feedback = conflict.feedbackId ? database_1.default.resident_feedbacks.get(conflict.feedbackId) : null;
    const relatedFeedback = conflict.relatedFeedbackId ?
        database_1.default.resident_feedbacks.get(conflict.relatedFeedbackId) : null;
    return {
        conflict,
        feedback,
        relatedFeedback
    };
}
