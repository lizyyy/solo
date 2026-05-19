"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompensateStatus = exports.EffectiveStatus = exports.PullStatus = exports.InstanceStatus = exports.ConfigStatus = void 0;
exports.ConfigStatus = {
    DRAFT: 'DRAFT',
    PUBLISHED: 'PUBLISHED',
    DEPRECATED: 'DEPRECATED',
};
exports.InstanceStatus = {
    ONLINE: 'ONLINE',
    OFFLINE: 'OFFLINE',
    UNHEALTHY: 'UNHEALTHY',
};
exports.PullStatus = {
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    PENDING: 'PENDING',
    TIMEOUT: 'TIMEOUT',
};
exports.EffectiveStatus = {
    EFFECTIVE: 'EFFECTIVE',
    NOT_EFFECTIVE: 'NOT_EFFECTIVE',
    PARTIAL: 'PARTIAL',
    UNKNOWN: 'UNKNOWN',
};
exports.CompensateStatus = {
    NOT_NEEDED: 'NOT_NEEDED',
    PENDING: 'PENDING',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
};
