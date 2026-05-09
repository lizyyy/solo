"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replayEvents = replayEvents;
exports.findEventsByBatch = findEventsByBatch;
exports.findEventsByEntity = findEventsByEntity;
exports.getEventTimeline = getEventTimeline;
const types_1 = require("../types");
function replayEvents(events, context = { initialEnrollments: [] }) {
    const sortedEvents = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    let currentBatch = context.initialBatch;
    const currentEnrollments = new Map();
    const replayEvents = [];
    const errors = [];
    context.initialEnrollments.forEach(e => currentEnrollments.set(e.id, e));
    for (const event of sortedEvents) {
        const result = applyEvent(event, currentBatch, currentEnrollments);
        if (result.success) {
            if (result.batch) {
                currentBatch = result.batch;
            }
            if (result.enrollment && event.enrollmentId) {
                currentEnrollments.set(event.enrollmentId, result.enrollment);
            }
            replayEvents.push({
                event,
                applied: true,
                changes: result.changes || {}
            });
        }
        else {
            errors.push(`事件 ${event.id} 应用失败: ${result.error?.message || '未知错误'}`);
            replayEvents.push({
                event,
                applied: false,
                changes: {}
            });
        }
    }
    return {
        success: true,
        data: {
            reconstructedBatch: currentBatch,
            reconstructedEnrollments: Array.from(currentEnrollments.values()),
            replayEvents,
            errors
        }
    };
}
function applyEvent(event, currentBatch, currentEnrollments) {
    if (event.entityType === 'batch') {
        return applyBatchEvent(event, currentBatch);
    }
    else if (event.entityType === 'enrollment') {
        return applyEnrollmentEvent(event, currentEnrollments);
    }
    return { success: true };
}
function applyBatchEvent(event, currentBatch) {
    if (!currentBatch && event.eventType === 'create') {
        const payload = event.payload;
        return {
            success: true,
            batch: {
                id: event.batchId,
                name: String(payload.name),
                description: String(payload.description),
                targetPeakLoad: Number(payload.targetPeakLoad),
                unitPrice: Number(payload.unitPrice),
                enrollmentStartTime: new Date(String(payload.enrollmentStartTime)),
                enrollmentEndTime: new Date(String(payload.enrollmentEndTime)),
                executionStartTime: new Date(String(payload.executionStartTime)),
                executionEndTime: new Date(String(payload.executionEndTime)),
                status: types_1.InvitationBatchStatus.DRAFT,
                createdAt: new Date(),
                updatedAt: new Date(),
                version: 1
            },
            changes: { status: types_1.InvitationBatchStatus.DRAFT }
        };
    }
    if (currentBatch) {
        const changes = {};
        if (event.toStatus) {
            changes.status = event.toStatus;
        }
        if (event.payload.updatedFields && typeof event.payload.updatedFields === 'object') {
            Object.assign(changes, event.payload.updatedFields);
        }
        return {
            success: true,
            batch: {
                ...currentBatch,
                ...changes,
                updatedAt: new Date(),
                version: currentBatch.version + 1
            },
            changes
        };
    }
    return {
        success: false,
        error: { code: 'BATCH_NOT_FOUND', message: '批次不存在，无法应用事件' }
    };
}
function applyEnrollmentEvent(event, currentEnrollments) {
    if (!event.enrollmentId) {
        return {
            success: false,
            error: { code: 'ENROLLMENT_ID_MISSING', message: '缺少报名 ID' }
        };
    }
    if (event.eventType === 'create') {
        const payload = event.payload;
        const enrollment = {
            id: event.enrollmentId,
            batchId: String(payload.batchId),
            enterpriseId: String(payload.enterpriseId),
            enterpriseName: String(payload.enterpriseName),
            declaredCapacity: Number(payload.declaredCapacity),
            contactName: String(payload.contactName),
            contactPhone: String(payload.contactPhone),
            status: types_1.EnrollmentStatus.PENDING_REVIEW,
            submittedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            version: 1
        };
        return {
            success: true,
            enrollment,
            changes: { status: types_1.EnrollmentStatus.PENDING_REVIEW }
        };
    }
    const existing = currentEnrollments.get(event.enrollmentId);
    if (!existing) {
        return {
            success: false,
            error: { code: 'ENROLLMENT_NOT_FOUND', message: '报名记录不存在' }
        };
    }
    const changes = {};
    if (event.toStatus) {
        changes.status = event.toStatus;
    }
    if (event.payload.updatedFields) {
        Object.assign(changes, event.payload.updatedFields);
    }
    return {
        success: true,
        enrollment: {
            ...existing,
            ...changes,
            updatedAt: new Date(),
            version: existing.version + 1
        },
        changes
    };
}
function findEventsByBatch(events, batchId) {
    return events.filter(e => e.batchId === batchId);
}
function findEventsByEntity(events, entityType, entityId) {
    return events.filter(e => {
        if (e.entityType === entityType) {
            if (entityType === 'batch')
                return e.batchId === entityId;
            return e.enrollmentId === entityId;
        }
        return false;
    });
}
function getEventTimeline(events) {
    return events
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map(e => ({
        time: new Date(e.timestamp),
        eventType: e.eventType,
        entityType: e.entityType,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        operator: e.operator
    }));
}
//# sourceMappingURL=eventReplay.js.map