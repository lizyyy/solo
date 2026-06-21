"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSample = createSample;
exports.createAnomaly = createAnomaly;
exports.createFittingParams = createFittingParams;
exports.createChangeRecord = createChangeRecord;
exports.createFittingSession = createFittingSession;
const uuid_1 = require("uuid");
function createSample(x, y, source, status = 'raw') {
    const now = Date.now();
    return {
        id: (0, uuid_1.v4)(),
        x,
        y,
        rawX: x,
        rawY: y,
        status,
        source,
        anomalies: [],
        createdAt: now,
        updatedAt: now,
    };
}
function createAnomaly(type, description, severity = 'medium', relatedSampleIds) {
    return {
        id: (0, uuid_1.v4)(),
        type,
        description,
        severity,
        detectedAt: Date.now(),
        detectedBy: 'system',
        relatedSampleIds,
        resolved: false,
    };
}
function createFittingParams(method, coefficients, rSquared, sampleIds, excludedSampleIds, calculatedBy, degree) {
    return {
        id: (0, uuid_1.v4)(),
        method,
        degree,
        coefficients,
        rSquared,
        sampleIds,
        excludedSampleIds,
        calculatedAt: Date.now(),
        calculatedBy,
    };
}
function createChangeRecord(entityType, entityId, field, oldValue, newValue, changedBy, reason) {
    return {
        id: (0, uuid_1.v4)(),
        entityType,
        entityId,
        field,
        oldValue,
        newValue,
        changedAt: Date.now(),
        changedBy,
        reason,
    };
}
function createFittingSession(name, createdBy) {
    const now = Date.now();
    return {
        id: (0, uuid_1.v4)(),
        name,
        samples: [],
        fittingParams: [],
        changeHistory: [],
        createdAt: now,
        updatedAt: now,
        createdBy,
    };
}
//# sourceMappingURL=factories.js.map