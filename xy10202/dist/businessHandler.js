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
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCreateRiskEvent = handleCreateRiskEvent;
exports.handleAssessSite = handleAssessSite;
exports.handleCreateRebooking = handleCreateRebooking;
exports.handleProcessRebooking = handleProcessRebooking;
exports.handleCancelEvent = handleCancelEvent;
exports.handleModifyEvent = handleModifyEvent;
exports.handleQuerySummary = handleQuerySummary;
exports.handleQueryProblems = handleQueryProblems;
exports.handleQuerySites = handleQuerySites;
exports.handleQueryOrders = handleQueryOrders;
exports.handleCreateNotification = handleCreateNotification;
exports.handleSendNotification = handleSendNotification;
exports.handleAcknowledgeNotification = handleAcknowledgeNotification;
exports.handleRetryNotification = handleRetryNotification;
exports.handleQueryNotifications = handleQueryNotifications;
const uuid_1 = require("uuid");
const storage_1 = require("./storage");
const riskService_1 = require("./services/riskService");
const notificationService_1 = require("./services/notificationService");
const crypto = __importStar(require("crypto"));
function generateNumber(prefix) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
}
function createSuccessResponse(data, requestId) {
    return {
        success: true,
        data,
        requestId,
        timestamp: new Date().toISOString()
    };
}
function createErrorResponse(code, message, requestId, details) {
    return {
        success: false,
        error: {
            code,
            message,
            details
        },
        requestId,
        timestamp: new Date().toISOString()
    };
}
function recordProblem(operationType, requestId, errorType, errorMessage, requestData, source) {
    const problem = {
        problemId: (0, uuid_1.v4)(),
        operationType,
        requestId,
        errorType,
        errorMessage,
        requestData,
        source,
        createdAt: new Date().toISOString(),
        status: 'OPEN',
        resolvedAt: null,
        resolution: null
    };
    return storage_1.storage.createProblem(problem);
}
function hashInput(input) {
    return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
}
function checkIdempotency(requestId, operationType, input) {
    storage_1.storage.cleanupExpiredRecords();
    const existing = storage_1.storage.getIdempotentRecord(requestId);
    if (existing && existing.operationType === operationType) {
        return {
            isDuplicate: true,
            cachedResult: existing.result
        };
    }
    return { isDuplicate: false };
}
function recordIdempotency(requestId, operationType, input, result) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    storage_1.storage.createIdempotentRecord({
        requestId,
        operationType,
        inputHash: hashInput(input),
        result,
        createdAt: new Date().toISOString(),
        expiresAt
    });
}
function validateRequiredFields(obj, fields) {
    for (const field of fields) {
        if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
            return `Missing required field: ${field}`;
        }
    }
    return null;
}
function handleCreateRiskEvent(request) {
    const idempotencyCheck = checkIdempotency(request.requestId, 'CREATE_EVENT', request);
    if (idempotencyCheck.isDuplicate) {
        return idempotencyCheck.cachedResult;
    }
    let validationError = validateRequiredFields(request, ['requestId', 'weatherAlert', 'source']);
    if (!validationError && request.weatherAlert) {
        validationError = validateRequiredFields(request.weatherAlert, ['alertId', 'alertType', 'severity', 'validFrom', 'validTo', 'description']);
    }
    if (validationError) {
        const response = createErrorResponse('VALIDATION_ERROR', validationError, request.requestId, request);
        recordProblem('CREATE_EVENT', request.requestId, 'VALIDATION_ERROR', validationError, request, request.source);
        recordIdempotency(request.requestId, 'CREATE_EVENT', request, response);
        return response;
    }
    try {
        const now = new Date().toISOString();
        const event = {
            eventId: (0, uuid_1.v4)(),
            eventNumber: generateNumber('EVT'),
            weatherAlert: {
                alertId: request.weatherAlert.alertId,
                alertType: request.weatherAlert.alertType,
                severity: request.weatherAlert.severity,
                validFrom: request.weatherAlert.validFrom,
                validTo: request.weatherAlert.validTo,
                description: request.weatherAlert.description
            },
            status: 'ACTIVE',
            assessedSites: [],
            affectedOrders: [],
            rebookings: [],
            createdAt: now,
            updatedAt: now
        };
        storage_1.storage.createEvent(event);
        const allSites = storage_1.storage.getAllSites();
        const assessedSites = [];
        const affectedOrderIds = [];
        for (const site of allSites) {
            const assessedRiskLevel = (0, riskService_1.assessSiteRisk)(site, event.weatherAlert);
            const actionRequired = (0, riskService_1.getActionRequired)(assessedRiskLevel);
            const assessedSite = {
                siteId: site.siteId,
                siteNumber: site.siteNumber,
                originalRiskLevel: site.riskLevel,
                assessedRiskLevel,
                assessmentReason: `自动评估 - ${assessedRiskLevel}`,
                assessmentTime: now,
                actionRequired
            };
            assessedSites.push(assessedSite);
            if (actionRequired === 'EVACUATE' || actionRequired === 'REASSIGN') {
                const orders = storage_1.storage.getOrdersBySite(site.siteId);
                affectedOrderIds.push(...orders.map(o => o.orderId));
            }
        }
        event.assessedSites = assessedSites;
        event.affectedOrders = [...new Set(affectedOrderIds)];
        storage_1.storage.updateEvent(event);
        const notifications = (0, notificationService_1.generateRiskAlertNotifications)(event);
        for (const notification of notifications) {
            (0, notificationService_1.simulateSendNotification)(notification.notificationId);
        }
        const response = createSuccessResponse({
            ...event,
            notificationsGenerated: notifications.length
        }, request.requestId);
        recordIdempotency(request.requestId, 'CREATE_EVENT', request, response);
        return response;
    }
    catch (error) {
        const errorMessage = error.message || 'Unknown error occurred';
        const response = createErrorResponse('SYSTEM_ERROR', errorMessage, request.requestId, { error: error.stack });
        recordProblem('CREATE_EVENT', request.requestId, 'SYSTEM_ERROR', errorMessage, request, request.source);
        recordIdempotency(request.requestId, 'CREATE_EVENT', request, response);
        return response;
    }
}
function handleAssessSite(request) {
    const idempotencyCheck = checkIdempotency(request.requestId, 'ASSESS_SITES', request);
    if (idempotencyCheck.isDuplicate) {
        return idempotencyCheck.cachedResult;
    }
    const validationError = validateRequiredFields(request, ['requestId', 'eventId', 'siteId', 'assessedRiskLevel', 'source']);
    if (validationError) {
        const response = createErrorResponse('VALIDATION_ERROR', validationError, request.requestId, request);
        recordProblem('ASSESS_SITES', request.requestId, 'VALIDATION_ERROR', validationError, request, request.source);
        recordIdempotency(request.requestId, 'ASSESS_SITES', request, response);
        return response;
    }
    try {
        const event = storage_1.storage.getEvent(request.eventId);
        if (!event) {
            const response = createErrorResponse('EVENT_NOT_FOUND', `Risk event not found: ${request.eventId}`, request.requestId, request);
            recordProblem('ASSESS_SITES', request.requestId, 'EVENT_NOT_FOUND', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'ASSESS_SITES', request, response);
            return response;
        }
        if (event.status !== 'ACTIVE' && event.status !== 'PROCESSING') {
            const response = createErrorResponse('INVALID_EVENT_STATUS', `Event is not in ACTIVE or PROCESSING status: ${event.status}`, request.requestId, request);
            recordProblem('ASSESS_SITES', request.requestId, 'INVALID_EVENT_STATUS', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'ASSESS_SITES', request, response);
            return response;
        }
        const site = storage_1.storage.getSite(request.siteId);
        if (!site) {
            const response = createErrorResponse('SITE_NOT_FOUND', `Site not found: ${request.siteId}`, request.requestId, request);
            recordProblem('ASSESS_SITES', request.requestId, 'SITE_NOT_FOUND', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'ASSESS_SITES', request, response);
            return response;
        }
        const validRiskLevels = ['NO_RISK', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
        if (!validRiskLevels.includes(request.assessedRiskLevel)) {
            const response = createErrorResponse('INVALID_RISK_LEVEL', `Invalid risk level: ${request.assessedRiskLevel}`, request.requestId, request);
            recordProblem('ASSESS_SITES', request.requestId, 'INVALID_RISK_LEVEL', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'ASSESS_SITES', request, response);
            return response;
        }
        const now = new Date().toISOString();
        const actionRequired = (0, riskService_1.getActionRequired)(request.assessedRiskLevel);
        const updatedAssessedSite = {
            siteId: site.siteId,
            siteNumber: site.siteNumber,
            originalRiskLevel: site.riskLevel,
            assessedRiskLevel: request.assessedRiskLevel,
            assessmentReason: request.assessmentReason,
            assessmentTime: now,
            actionRequired
        };
        const existingIndex = event.assessedSites.findIndex(s => s.siteId === site.siteId);
        if (existingIndex >= 0) {
            event.assessedSites[existingIndex] = updatedAssessedSite;
        }
        else {
            event.assessedSites.push(updatedAssessedSite);
        }
        site.riskLevel = request.assessedRiskLevel;
        storage_1.storage.updateSite(site);
        if (actionRequired === 'EVACUATE' || actionRequired === 'REASSIGN') {
            const orders = storage_1.storage.getOrdersBySite(site.siteId);
            const newOrderIds = orders.map(o => o.orderId);
            event.affectedOrders = [...new Set([...event.affectedOrders, ...newOrderIds])];
        }
        event.updatedAt = now;
        storage_1.storage.updateEvent(event);
        const response = createSuccessResponse({
            eventId: event.eventId,
            siteId: site.siteId,
            newRiskLevel: request.assessedRiskLevel,
            actionRequired,
            eventStatus: event.status
        }, request.requestId);
        recordIdempotency(request.requestId, 'ASSESS_SITES', request, response);
        return response;
    }
    catch (error) {
        const errorMessage = error.message || 'Unknown error occurred';
        const response = createErrorResponse('SYSTEM_ERROR', errorMessage, request.requestId, { error: error.stack });
        recordProblem('ASSESS_SITES', request.requestId, 'SYSTEM_ERROR', errorMessage, request, request.source);
        recordIdempotency(request.requestId, 'ASSESS_SITES', request, response);
        return response;
    }
}
function handleCreateRebooking(request) {
    const idempotencyCheck = checkIdempotency(request.requestId, 'CREATE_REBOOKING', request);
    if (idempotencyCheck.isDuplicate) {
        return idempotencyCheck.cachedResult;
    }
    const validationError = validateRequiredFields(request, ['requestId', 'eventId', 'orderId', 'reason', 'source']);
    if (validationError) {
        const response = createErrorResponse('VALIDATION_ERROR', validationError, request.requestId, request);
        recordProblem('CREATE_REBOOKING', request.requestId, 'VALIDATION_ERROR', validationError, request, request.source);
        recordIdempotency(request.requestId, 'CREATE_REBOOKING', request, response);
        return response;
    }
    try {
        const event = storage_1.storage.getEvent(request.eventId);
        if (!event) {
            const response = createErrorResponse('EVENT_NOT_FOUND', `Risk event not found: ${request.eventId}`, request.requestId, request);
            recordProblem('CREATE_REBOOKING', request.requestId, 'EVENT_NOT_FOUND', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'CREATE_REBOOKING', request, response);
            return response;
        }
        if (event.status !== 'ACTIVE' && event.status !== 'PROCESSING') {
            const response = createErrorResponse('INVALID_EVENT_STATUS', `Event is not in ACTIVE or PROCESSING status: ${event.status}`, request.requestId, request);
            recordProblem('CREATE_REBOOKING', request.requestId, 'INVALID_EVENT_STATUS', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'CREATE_REBOOKING', request, response);
            return response;
        }
        const order = storage_1.storage.getOrder(request.orderId);
        if (!order) {
            const response = createErrorResponse('ORDER_NOT_FOUND', `Order not found: ${request.orderId}`, request.requestId, request);
            recordProblem('CREATE_REBOOKING', request.requestId, 'ORDER_NOT_FOUND', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'CREATE_REBOOKING', request, response);
            return response;
        }
        if (!['CONFIRMED', 'CHECKED_IN'].includes(order.status)) {
            const response = createErrorResponse('INVALID_ORDER_STATUS', `Order is not in CONFIRMED or CHECKED_IN status: ${order.status}`, request.requestId, request);
            recordProblem('CREATE_REBOOKING', request.requestId, 'INVALID_ORDER_STATUS', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'CREATE_REBOOKING', request, response);
            return response;
        }
        const existingRebookings = storage_1.storage.getRebookingsByEvent(event.eventId);
        const existingRebook = existingRebookings.find(r => r.originalOrderId === order.orderId && r.status !== 'COMPLETED' && r.status !== 'CANCELLED');
        if (existingRebook) {
            const response = createErrorResponse('REBOOKING_EXISTS', `A rebooking already exists for this order: ${existingRebook.rebookingId}`, request.requestId, request);
            recordProblem('CREATE_REBOOKING', request.requestId, 'REBOOKING_EXISTS', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'CREATE_REBOOKING', request, response);
            return response;
        }
        const availableSites = (0, riskService_1.findAvailableReplacementSites)(order.siteId);
        const now = new Date().toISOString();
        const rebooking = {
            rebookingId: (0, uuid_1.v4)(),
            rebookingNumber: generateNumber('RBK'),
            eventId: event.eventId,
            originalOrderId: order.orderId,
            originalSiteId: order.siteId,
            targetSiteId: null,
            status: 'PENDING',
            reason: request.reason,
            createdAt: now,
            updatedAt: now,
            completedAt: null
        };
        storage_1.storage.createRebooking(rebooking);
        event.rebookings.push(rebooking.rebookingId);
        event.updatedAt = now;
        event.status = 'PROCESSING';
        storage_1.storage.updateEvent(event);
        order.status = 'REBOOKING';
        storage_1.storage.updateOrder(order);
        const rebookingNotifications = (0, notificationService_1.generateRebookingInitiatedNotifications)(event, rebooking.rebookingId, order, availableSites.length);
        for (const notification of rebookingNotifications) {
            (0, notificationService_1.simulateSendNotification)(notification.notificationId);
        }
        const response = createSuccessResponse({
            rebookingId: rebooking.rebookingId,
            rebookingNumber: rebooking.rebookingNumber,
            orderId: order.orderId,
            orderNumber: order.orderNumber,
            originalSiteId: order.siteId,
            availableReplacements: availableSites.map(s => ({
                siteId: s.siteId,
                siteNumber: s.siteNumber,
                type: s.type,
                elevation: s.elevation
            })),
            notificationsGenerated: rebookingNotifications.length
        }, request.requestId);
        recordIdempotency(request.requestId, 'CREATE_REBOOKING', request, response);
        return response;
    }
    catch (error) {
        const errorMessage = error.message || 'Unknown error occurred';
        const response = createErrorResponse('SYSTEM_ERROR', errorMessage, request.requestId, { error: error.stack });
        recordProblem('CREATE_REBOOKING', request.requestId, 'SYSTEM_ERROR', errorMessage, request, request.source);
        recordIdempotency(request.requestId, 'CREATE_REBOOKING', request, response);
        return response;
    }
}
function handleProcessRebooking(request) {
    const idempotencyCheck = checkIdempotency(request.requestId, 'PROCESS_REBOOKING', request);
    if (idempotencyCheck.isDuplicate) {
        return idempotencyCheck.cachedResult;
    }
    const validationError = validateRequiredFields(request, ['requestId', 'rebookingId', 'targetSiteId', 'source']);
    if (validationError) {
        const response = createErrorResponse('VALIDATION_ERROR', validationError, request.requestId, request);
        recordProblem('PROCESS_REBOOKING', request.requestId, 'VALIDATION_ERROR', validationError, request, request.source);
        recordIdempotency(request.requestId, 'PROCESS_REBOOKING', request, response);
        return response;
    }
    try {
        const rebooking = storage_1.storage.getRebooking(request.rebookingId);
        if (!rebooking) {
            const response = createErrorResponse('REBOOKING_NOT_FOUND', `Rebooking not found: ${request.rebookingId}`, request.requestId, request);
            recordProblem('PROCESS_REBOOKING', request.requestId, 'REBOOKING_NOT_FOUND', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'PROCESS_REBOOKING', request, response);
            return response;
        }
        if (rebooking.status !== 'PENDING') {
            const response = createErrorResponse('INVALID_REBOOKING_STATUS', `Rebooking is not in PENDING status: ${rebooking.status}`, request.requestId, request);
            recordProblem('PROCESS_REBOOKING', request.requestId, 'INVALID_REBOOKING_STATUS', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'PROCESS_REBOOKING', request, response);
            return response;
        }
        const targetSite = storage_1.storage.getSite(request.targetSiteId);
        if (!targetSite) {
            const response = createErrorResponse('SITE_NOT_FOUND', `Target site not found: ${request.targetSiteId}`, request.requestId, request);
            recordProblem('PROCESS_REBOOKING', request.requestId, 'SITE_NOT_FOUND', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'PROCESS_REBOOKING', request, response);
            return response;
        }
        if (!(0, riskService_1.isSiteReassignable)(targetSite.siteId)) {
            const response = createErrorResponse('SITE_NOT_AVAILABLE', `Target site is not available for rebooking: ${targetSite.siteNumber}`, request.requestId, request);
            recordProblem('PROCESS_REBOOKING', request.requestId, 'SITE_NOT_AVAILABLE', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'PROCESS_REBOOKING', request, response);
            return response;
        }
        const order = storage_1.storage.getOrder(rebooking.originalOrderId);
        if (!order) {
            const response = createErrorResponse('ORDER_NOT_FOUND', `Original order not found: ${rebooking.originalOrderId}`, request.requestId, request);
            recordProblem('PROCESS_REBOOKING', request.requestId, 'ORDER_NOT_FOUND', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'PROCESS_REBOOKING', request, response);
            return response;
        }
        const originalSite = storage_1.storage.getSite(rebooking.originalSiteId);
        if (!originalSite) {
            const response = createErrorResponse('SITE_NOT_FOUND', `Original site not found: ${rebooking.originalSiteId}`, request.requestId, request);
            recordProblem('PROCESS_REBOOKING', request.requestId, 'SITE_NOT_FOUND', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'PROCESS_REBOOKING', request, response);
            return response;
        }
        const now = new Date().toISOString();
        const lockId = (0, uuid_1.v4)();
        const lock = {
            lockId,
            siteId: targetSite.siteId,
            lockType: 'REBOOKING',
            lockedBy: rebooking.rebookingId,
            lockedAt: now,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            reason: `Locked for rebooking ${rebooking.rebookingNumber}`,
            isActive: true
        };
        storage_1.storage.createLock(lock);
        targetSite.isLocked = true;
        targetSite.lockedBy = lockId;
        storage_1.storage.updateSite(targetSite);
        originalSite.isOccupied = false;
        originalSite.isLocked = false;
        originalSite.lockedBy = null;
        storage_1.storage.updateSite(originalSite);
        order.siteId = targetSite.siteId;
        order.status = 'REBOOKED';
        storage_1.storage.updateOrder(order);
        targetSite.isOccupied = true;
        targetSite.isLocked = false;
        targetSite.lockedBy = null;
        storage_1.storage.updateSite(targetSite);
        lock.isActive = false;
        storage_1.storage.updateLock(lock);
        rebooking.targetSiteId = targetSite.siteId;
        rebooking.status = 'COMPLETED';
        rebooking.updatedAt = now;
        rebooking.completedAt = now;
        storage_1.storage.updateRebooking(rebooking);
        const event = storage_1.storage.getEvent(rebooking.eventId);
        if (event) {
            const remainingRebookings = event.rebookings
                .map(rid => storage_1.storage.getRebooking(rid))
                .filter(r => r && ['PENDING', 'IN_PROGRESS'].includes(r.status));
            if (remainingRebookings.length === 0) {
                event.status = 'RESOLVED';
                event.updatedAt = now;
                storage_1.storage.updateEvent(event);
            }
        }
        let completedNotifications = 0;
        if (event) {
            const completeNotifications = (0, notificationService_1.generateRebookingCompletedNotifications)(event, rebooking.rebookingId, order, originalSite.siteNumber, targetSite.siteNumber);
            for (const notification of completeNotifications) {
                (0, notificationService_1.simulateSendNotification)(notification.notificationId);
            }
            completedNotifications = completeNotifications.length;
        }
        const response = createSuccessResponse({
            rebookingId: rebooking.rebookingId,
            rebookingNumber: rebooking.rebookingNumber,
            orderId: order.orderId,
            orderNumber: order.orderNumber,
            originalSiteId: originalSite.siteId,
            targetSiteId: targetSite.siteId,
            targetSiteNumber: targetSite.siteNumber,
            newOrderStatus: order.status,
            notificationsGenerated: completedNotifications
        }, request.requestId);
        recordIdempotency(request.requestId, 'PROCESS_REBOOKING', request, response);
        return response;
    }
    catch (error) {
        const errorMessage = error.message || 'Unknown error occurred';
        const response = createErrorResponse('SYSTEM_ERROR', errorMessage, request.requestId, { error: error.stack });
        recordProblem('PROCESS_REBOOKING', request.requestId, 'SYSTEM_ERROR', errorMessage, request, request.source);
        recordIdempotency(request.requestId, 'PROCESS_REBOOKING', request, response);
        return response;
    }
}
function handleCancelEvent(request) {
    const idempotencyCheck = checkIdempotency(request.requestId, 'CANCEL_EVENT', request);
    if (idempotencyCheck.isDuplicate) {
        return idempotencyCheck.cachedResult;
    }
    const validationError = validateRequiredFields(request, ['requestId', 'eventId', 'reason', 'source']);
    if (validationError) {
        const response = createErrorResponse('VALIDATION_ERROR', validationError, request.requestId, request);
        recordProblem('CANCEL_EVENT', request.requestId, 'VALIDATION_ERROR', validationError, request, request.source);
        recordIdempotency(request.requestId, 'CANCEL_EVENT', request, response);
        return response;
    }
    try {
        const event = storage_1.storage.getEvent(request.eventId);
        if (!event) {
            const response = createErrorResponse('EVENT_NOT_FOUND', `Risk event not found: ${request.eventId}`, request.requestId, request);
            recordProblem('CANCEL_EVENT', request.requestId, 'EVENT_NOT_FOUND', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'CANCEL_EVENT', request, response);
            return response;
        }
        if (event.status === 'RESOLVED' || event.status === 'CANCELLED') {
            const response = createErrorResponse('INVALID_EVENT_STATUS', `Event already in ${event.status} status`, request.requestId, request);
            recordProblem('CANCEL_EVENT', request.requestId, 'INVALID_EVENT_STATUS', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'CANCEL_EVENT', request, response);
            return response;
        }
        const pendingRebookings = storage_1.storage.getRebookingsByEvent(event.eventId)
            .filter(r => ['PENDING', 'IN_PROGRESS'].includes(r.status));
        if (pendingRebookings.length > 0) {
            const response = createErrorResponse('PENDING_REBOOKINGS', `There are ${pendingRebookings.length} pending rebookings. Cancel those first.`, request.requestId, request);
            recordProblem('CANCEL_EVENT', request.requestId, 'PENDING_REBOOKINGS', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'CANCEL_EVENT', request, response);
            return response;
        }
        const now = new Date().toISOString();
        for (const site of event.assessedSites) {
            const dbSite = storage_1.storage.getSite(site.siteId);
            if (dbSite) {
                dbSite.riskLevel = site.originalRiskLevel;
                storage_1.storage.updateSite(dbSite);
            }
        }
        for (const rid of event.rebookings) {
            const rebooking = storage_1.storage.getRebooking(rid);
            if (rebooking && rebooking.status === 'PENDING') {
                rebooking.status = 'CANCELLED';
                rebooking.updatedAt = now;
                storage_1.storage.updateRebooking(rebooking);
                const order = storage_1.storage.getOrder(rebooking.originalOrderId);
                if (order && order.status === 'REBOOKING') {
                    order.status = 'CONFIRMED';
                    storage_1.storage.updateOrder(order);
                }
            }
        }
        event.status = 'CANCELLED';
        event.updatedAt = now;
        storage_1.storage.updateEvent(event);
        const cancelNotifications = (0, notificationService_1.generateEventCancelledNotifications)(event);
        for (const notification of cancelNotifications) {
            (0, notificationService_1.simulateSendNotification)(notification.notificationId);
        }
        const response = createSuccessResponse({
            eventId: event.eventId,
            eventNumber: event.eventNumber,
            newStatus: event.status,
            cancelledReason: request.reason,
            notificationsGenerated: cancelNotifications.length
        }, request.requestId);
        recordIdempotency(request.requestId, 'CANCEL_EVENT', request, response);
        return response;
    }
    catch (error) {
        const errorMessage = error.message || 'Unknown error occurred';
        const response = createErrorResponse('SYSTEM_ERROR', errorMessage, request.requestId, { error: error.stack });
        recordProblem('CANCEL_EVENT', request.requestId, 'SYSTEM_ERROR', errorMessage, request, request.source);
        recordIdempotency(request.requestId, 'CANCEL_EVENT', request, response);
        return response;
    }
}
function handleModifyEvent(request) {
    const idempotencyCheck = checkIdempotency(request.requestId, 'MODIFY_EVENT', request);
    if (idempotencyCheck.isDuplicate) {
        return idempotencyCheck.cachedResult;
    }
    const validationError = validateRequiredFields(request, ['requestId', 'eventId', 'updates', 'source']);
    if (validationError) {
        const response = createErrorResponse('VALIDATION_ERROR', validationError, request.requestId, request);
        recordProblem('MODIFY_EVENT', request.requestId, 'VALIDATION_ERROR', validationError, request, request.source);
        recordIdempotency(request.requestId, 'MODIFY_EVENT', request, response);
        return response;
    }
    try {
        const event = storage_1.storage.getEvent(request.eventId);
        if (!event) {
            const response = createErrorResponse('EVENT_NOT_FOUND', `Risk event not found: ${request.eventId}`, request.requestId, request);
            recordProblem('MODIFY_EVENT', request.requestId, 'EVENT_NOT_FOUND', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'MODIFY_EVENT', request, response);
            return response;
        }
        const allowedStatuses = ['DRAFT', 'ACTIVE', 'PROCESSING', 'RESOLVED', 'CANCELLED'];
        if (request.updates.status && !allowedStatuses.includes(request.updates.status)) {
            const response = createErrorResponse('INVALID_STATUS', `Invalid status: ${request.updates.status}`, request.requestId, request);
            recordProblem('MODIFY_EVENT', request.requestId, 'INVALID_STATUS', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'MODIFY_EVENT', request, response);
            return response;
        }
        const originalStatus = event.status;
        if (request.updates.status) {
            event.status = request.updates.status;
        }
        if (request.updates.weatherAlert) {
            event.weatherAlert = { ...event.weatherAlert, ...request.updates.weatherAlert };
        }
        event.updatedAt = new Date().toISOString();
        storage_1.storage.updateEvent(event);
        const response = createSuccessResponse({
            eventId: event.eventId,
            eventNumber: event.eventNumber,
            originalStatus,
            newStatus: event.status
        }, request.requestId);
        recordIdempotency(request.requestId, 'MODIFY_EVENT', request, response);
        return response;
    }
    catch (error) {
        const errorMessage = error.message || 'Unknown error occurred';
        const response = createErrorResponse('SYSTEM_ERROR', errorMessage, request.requestId, { error: error.stack });
        recordProblem('MODIFY_EVENT', request.requestId, 'SYSTEM_ERROR', errorMessage, request, request.source);
        recordIdempotency(request.requestId, 'MODIFY_EVENT', request, response);
        return response;
    }
}
function handleQuerySummary(request) {
    const requestId = (0, uuid_1.v4)();
    storage_1.storage.cleanupExpiredRecords();
    try {
        let events = storage_1.storage.getAllEvents();
        if (request.eventId) {
            const event = storage_1.storage.getEvent(request.eventId);
            events = event ? [event] : [];
        }
        if (request.status) {
            events = events.filter(e => e.status === request.status);
        }
        const summary = events.map(event => {
            const rebookings = storage_1.storage.getRebookingsByEvent(event.eventId);
            const pendingRebookings = rebookings.filter(r => r.status === 'PENDING');
            const completedRebookings = rebookings.filter(r => r.status === 'COMPLETED');
            const criticalSites = event.assessedSites.filter(s => s.assessedRiskLevel === 'CRITICAL');
            const highSites = event.assessedSites.filter(s => s.assessedRiskLevel === 'HIGH');
            const mediumSites = event.assessedSites.filter(s => s.assessedRiskLevel === 'MEDIUM');
            return {
                eventId: event.eventId,
                eventNumber: event.eventNumber,
                status: event.status,
                weatherAlert: event.weatherAlert,
                riskAssessment: {
                    totalAssessed: event.assessedSites.length,
                    critical: criticalSites.length,
                    high: highSites.length,
                    medium: mediumSites.length
                },
                affectedOrders: event.affectedOrders.length,
                rebookings: {
                    total: rebookings.length,
                    pending: pendingRebookings.length,
                    completed: completedRebookings.length
                },
                createdAt: event.createdAt,
                updatedAt: event.updatedAt
            };
        });
        return createSuccessResponse({
            totalEvents: events.length,
            events: summary
        }, requestId);
    }
    catch (error) {
        const errorMessage = error.message || 'Unknown error occurred';
        return createErrorResponse('SYSTEM_ERROR', errorMessage, requestId, { error: error.stack });
    }
}
function handleQueryProblems() {
    const requestId = (0, uuid_1.v4)();
    storage_1.storage.cleanupExpiredRecords();
    try {
        const problems = storage_1.storage.getProblems();
        return createSuccessResponse({
            total: problems.length,
            open: problems.filter(p => p.status === 'OPEN').length,
            problems
        }, requestId);
    }
    catch (error) {
        const errorMessage = error.message || 'Unknown error occurred';
        return createErrorResponse('SYSTEM_ERROR', errorMessage, requestId, { error: error.stack });
    }
}
function handleQuerySites() {
    const requestId = (0, uuid_1.v4)();
    try {
        const sites = storage_1.storage.getAllSites();
        return createSuccessResponse({
            total: sites.length,
            sites: sites.map(s => ({
                siteId: s.siteId,
                siteNumber: s.siteNumber,
                type: s.type,
                elevation: s.elevation,
                distanceToWater: s.distanceToWater,
                riskLevel: s.riskLevel,
                isOccupied: s.isOccupied,
                isLocked: s.isLocked
            }))
        }, requestId);
    }
    catch (error) {
        const errorMessage = error.message || 'Unknown error occurred';
        return createErrorResponse('SYSTEM_ERROR', errorMessage, requestId, { error: error.stack });
    }
}
function handleQueryOrders() {
    const requestId = (0, uuid_1.v4)();
    try {
        const orders = storage_1.storage.getAllOrders();
        return createSuccessResponse({
            total: orders.length,
            orders: orders.map(o => ({
                orderId: o.orderId,
                orderNumber: o.orderNumber,
                customerName: o.customerName,
                siteId: o.siteId,
                checkInDate: o.checkInDate,
                checkOutDate: o.checkOutDate,
                status: o.status,
                guestCount: o.guestCount
            }))
        }, requestId);
    }
    catch (error) {
        const errorMessage = error.message || 'Unknown error occurred';
        return createErrorResponse('SYSTEM_ERROR', errorMessage, requestId, { error: error.stack });
    }
}
function handleCreateNotification(request) {
    const idempotencyCheck = checkIdempotency(request.requestId, 'SEND_NOTIFICATION', request);
    if (idempotencyCheck.isDuplicate) {
        return idempotencyCheck.cachedResult;
    }
    const validationError = validateRequiredFields(request, [
        'requestId', 'recipientId', 'recipientType', 'recipientName',
        'recipientContact', 'type', 'channel', 'title', 'content', 'source'
    ]);
    if (validationError) {
        const response = createErrorResponse('VALIDATION_ERROR', validationError, request.requestId, request);
        recordProblem('SEND_NOTIFICATION', request.requestId, 'VALIDATION_ERROR', validationError, request, request.source);
        recordIdempotency(request.requestId, 'SEND_NOTIFICATION', request, response);
        return response;
    }
    try {
        const notification = (0, notificationService_1.createNotification)({
            eventId: request.eventId,
            rebookingId: request.rebookingId,
            orderId: request.orderId,
            recipientId: request.recipientId,
            recipientType: request.recipientType,
            recipientName: request.recipientName,
            recipientContact: request.recipientContact,
            type: request.type,
            channel: request.channel,
            title: request.title,
            content: request.content
        });
        const sendResult = (0, notificationService_1.simulateSendNotification)(notification.notificationId);
        const response = createSuccessResponse({
            notificationId: notification.notificationId,
            notificationNumber: notification.notificationNumber,
            status: notification.status,
            sent: sendResult.success,
            sendError: sendResult.error
        }, request.requestId);
        recordIdempotency(request.requestId, 'SEND_NOTIFICATION', request, response);
        return response;
    }
    catch (error) {
        const errorMessage = error.message || 'Unknown error occurred';
        const response = createErrorResponse('SYSTEM_ERROR', errorMessage, request.requestId, { error: error.stack });
        recordProblem('SEND_NOTIFICATION', request.requestId, 'SYSTEM_ERROR', errorMessage, request, request.source);
        recordIdempotency(request.requestId, 'SEND_NOTIFICATION', request, response);
        return response;
    }
}
function handleSendNotification(request) {
    const idempotencyCheck = checkIdempotency(request.requestId, 'SEND_NOTIFICATION', request);
    if (idempotencyCheck.isDuplicate) {
        return idempotencyCheck.cachedResult;
    }
    const validationError = validateRequiredFields(request, ['requestId', 'notificationId', 'source']);
    if (validationError) {
        const response = createErrorResponse('VALIDATION_ERROR', validationError, request.requestId, request);
        recordProblem('SEND_NOTIFICATION', request.requestId, 'VALIDATION_ERROR', validationError, request, request.source);
        recordIdempotency(request.requestId, 'SEND_NOTIFICATION', request, response);
        return response;
    }
    try {
        const notification = storage_1.storage.getNotification(request.notificationId);
        if (!notification) {
            const response = createErrorResponse('NOTIFICATION_NOT_FOUND', `Notification not found: ${request.notificationId}`, request.requestId, request);
            recordProblem('SEND_NOTIFICATION', request.requestId, 'NOTIFICATION_NOT_FOUND', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'SEND_NOTIFICATION', request, response);
            return response;
        }
        if (['CANCELLED', 'ACKNOWLEDGED'].includes(notification.status)) {
            const response = createErrorResponse('INVALID_NOTIFICATION_STATUS', `Cannot send notification in ${notification.status} status`, request.requestId, request);
            recordProblem('SEND_NOTIFICATION', request.requestId, 'INVALID_NOTIFICATION_STATUS', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'SEND_NOTIFICATION', request, response);
            return response;
        }
        const sendResult = (0, notificationService_1.simulateSendNotification)(notification.notificationId);
        const updatedNotification = storage_1.storage.getNotification(notification.notificationId);
        const response = createSuccessResponse({
            notificationId: notification.notificationId,
            status: updatedNotification?.status,
            sent: sendResult.success,
            sendError: sendResult.error
        }, request.requestId);
        recordIdempotency(request.requestId, 'SEND_NOTIFICATION', request, response);
        return response;
    }
    catch (error) {
        const errorMessage = error.message || 'Unknown error occurred';
        const response = createErrorResponse('SYSTEM_ERROR', errorMessage, request.requestId, { error: error.stack });
        recordProblem('SEND_NOTIFICATION', request.requestId, 'SYSTEM_ERROR', errorMessage, request, request.source);
        recordIdempotency(request.requestId, 'SEND_NOTIFICATION', request, response);
        return response;
    }
}
function handleAcknowledgeNotification(request) {
    const idempotencyCheck = checkIdempotency(request.requestId, 'ACK_NOTIFICATION', request);
    if (idempotencyCheck.isDuplicate) {
        return idempotencyCheck.cachedResult;
    }
    const validationError = validateRequiredFields(request, ['requestId', 'notificationId', 'acknowledgedBy', 'source']);
    if (validationError) {
        const response = createErrorResponse('VALIDATION_ERROR', validationError, request.requestId, request);
        recordProblem('ACK_NOTIFICATION', request.requestId, 'VALIDATION_ERROR', validationError, request, request.source);
        recordIdempotency(request.requestId, 'ACK_NOTIFICATION', request, response);
        return response;
    }
    try {
        const notification = storage_1.storage.getNotification(request.notificationId);
        if (!notification) {
            const response = createErrorResponse('NOTIFICATION_NOT_FOUND', `Notification not found: ${request.notificationId}`, request.requestId, request);
            recordProblem('ACK_NOTIFICATION', request.requestId, 'NOTIFICATION_NOT_FOUND', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'ACK_NOTIFICATION', request, response);
            return response;
        }
        if (!['SENT', 'DELIVERED'].includes(notification.status)) {
            const response = createErrorResponse('INVALID_NOTIFICATION_STATUS', `Can only acknowledge SENT or DELIVERED notifications, current: ${notification.status}`, request.requestId, request);
            recordProblem('ACK_NOTIFICATION', request.requestId, 'INVALID_NOTIFICATION_STATUS', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'ACK_NOTIFICATION', request, response);
            return response;
        }
        const updated = (0, notificationService_1.acknowledgeNotification)(notification.notificationId, request.acknowledgedBy, request.note);
        if (!updated) {
            const response = createErrorResponse('ACKNOWLEDGE_FAILED', 'Failed to acknowledge notification', request.requestId, request);
            recordProblem('ACK_NOTIFICATION', request.requestId, 'ACKNOWLEDGE_FAILED', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'ACK_NOTIFICATION', request, response);
            return response;
        }
        const response = createSuccessResponse({
            notificationId: updated.notificationId,
            status: updated.status,
            acknowledgedAt: updated.acknowledgedAt,
            acknowledgedBy: updated.acknowledgedBy
        }, request.requestId);
        recordIdempotency(request.requestId, 'ACK_NOTIFICATION', request, response);
        return response;
    }
    catch (error) {
        const errorMessage = error.message || 'Unknown error occurred';
        const response = createErrorResponse('SYSTEM_ERROR', errorMessage, request.requestId, { error: error.stack });
        recordProblem('ACK_NOTIFICATION', request.requestId, 'SYSTEM_ERROR', errorMessage, request, request.source);
        recordIdempotency(request.requestId, 'ACK_NOTIFICATION', request, response);
        return response;
    }
}
function handleRetryNotification(request) {
    const idempotencyCheck = checkIdempotency(request.requestId, 'RETRY_NOTIFICATION', request);
    if (idempotencyCheck.isDuplicate) {
        return idempotencyCheck.cachedResult;
    }
    const validationError = validateRequiredFields(request, ['requestId', 'notificationId', 'source']);
    if (validationError) {
        const response = createErrorResponse('VALIDATION_ERROR', validationError, request.requestId, request);
        recordProblem('RETRY_NOTIFICATION', request.requestId, 'VALIDATION_ERROR', validationError, request, request.source);
        recordIdempotency(request.requestId, 'RETRY_NOTIFICATION', request, response);
        return response;
    }
    try {
        const notification = storage_1.storage.getNotification(request.notificationId);
        if (!notification) {
            const response = createErrorResponse('NOTIFICATION_NOT_FOUND', `Notification not found: ${request.notificationId}`, request.requestId, request);
            recordProblem('RETRY_NOTIFICATION', request.requestId, 'NOTIFICATION_NOT_FOUND', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'RETRY_NOTIFICATION', request, response);
            return response;
        }
        if (notification.status !== 'FAILED') {
            const response = createErrorResponse('INVALID_NOTIFICATION_STATUS', `Can only retry FAILED notifications, current: ${notification.status}`, request.requestId, request);
            recordProblem('RETRY_NOTIFICATION', request.requestId, 'INVALID_NOTIFICATION_STATUS', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'RETRY_NOTIFICATION', request, response);
            return response;
        }
        if (notification.retryCount >= notification.maxRetries) {
            const response = createErrorResponse('MAX_RETRIES_EXCEEDED', `Maximum retries exceeded: ${notification.retryCount}/${notification.maxRetries}`, request.requestId, request);
            recordProblem('RETRY_NOTIFICATION', request.requestId, 'MAX_RETRIES_EXCEEDED', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'RETRY_NOTIFICATION', request, response);
            return response;
        }
        const retried = (0, notificationService_1.retryNotification)(notification.notificationId);
        if (!retried) {
            const response = createErrorResponse('RETRY_FAILED', 'Failed to retry notification', request.requestId, request);
            recordProblem('RETRY_NOTIFICATION', request.requestId, 'RETRY_FAILED', response.error.message, request, request.source);
            recordIdempotency(request.requestId, 'RETRY_NOTIFICATION', request, response);
            return response;
        }
        const response = createSuccessResponse({
            notificationId: retried.notificationId,
            status: retried.status,
            retryCount: retried.retryCount,
            maxRetries: retried.maxRetries
        }, request.requestId);
        recordIdempotency(request.requestId, 'RETRY_NOTIFICATION', request, response);
        return response;
    }
    catch (error) {
        const errorMessage = error.message || 'Unknown error occurred';
        const response = createErrorResponse('SYSTEM_ERROR', errorMessage, request.requestId, { error: error.stack });
        recordProblem('RETRY_NOTIFICATION', request.requestId, 'SYSTEM_ERROR', errorMessage, request, request.source);
        recordIdempotency(request.requestId, 'RETRY_NOTIFICATION', request, response);
        return response;
    }
}
function handleQueryNotifications(request) {
    const requestId = (0, uuid_1.v4)();
    storage_1.storage.cleanupExpiredRecords();
    try {
        const notifications = (0, notificationService_1.queryNotifications)({
            eventId: request.eventId,
            status: request.status,
            recipientType: request.recipientType,
            type: request.type
        });
        const summary = {
            total: notifications.length,
            pending: notifications.filter(n => n.status === 'PENDING').length,
            sending: notifications.filter(n => n.status === 'SENDING').length,
            sent: notifications.filter(n => n.status === 'SENT').length,
            delivered: notifications.filter(n => n.status === 'DELIVERED').length,
            acknowledged: notifications.filter(n => n.status === 'ACKNOWLEDGED').length,
            failed: notifications.filter(n => n.status === 'FAILED').length
        };
        return createSuccessResponse({
            summary,
            notifications: notifications.map(n => ({
                notificationId: n.notificationId,
                notificationNumber: n.notificationNumber,
                eventId: n.eventId,
                rebookingId: n.rebookingId,
                orderId: n.orderId,
                recipientType: n.recipientType,
                recipientName: n.recipientName,
                type: n.type,
                channel: n.channel,
                title: n.title,
                status: n.status,
                retryCount: n.retryCount,
                lastError: n.lastError,
                createdAt: n.createdAt,
                sentAt: n.sentAt,
                deliveredAt: n.deliveredAt,
                acknowledgedAt: n.acknowledgedAt
            }))
        }, requestId);
    }
    catch (error) {
        const errorMessage = error.message || 'Unknown error occurred';
        return createErrorResponse('SYSTEM_ERROR', errorMessage, requestId, { error: error.stack });
    }
}
//# sourceMappingURL=businessHandler.js.map