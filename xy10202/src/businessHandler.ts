import { v4 as uuidv4 } from 'uuid';
import {
  RiskEvent,
  AssessedSite,
  Rebooking,
  ResourceLock,
  ProblemRecord,
  ApiResponse,
  CreateRiskEventRequest,
  AssessSiteRequest,
  CreateRebookingRequest,
  ProcessRebookingRequest,
  CancelEventRequest,
  ModifyEventRequest,
  QuerySummaryRequest,
  RiskEventStatus,
  RiskLevel,
  OrderStatus,
  RebookingStatus,
  LockType,
  OperationType,
  CreateNotificationRequest,
  SendNotificationRequest,
  AcknowledgeNotificationRequest,
  RetryNotificationRequest,
  QueryNotificationsRequest
} from './types';
import { storage } from './storage';
import { assessSiteRisk, getActionRequired, isSiteReassignable, findAvailableReplacementSites } from './services/riskService';
import {
  createNotification as createNotificationService,
  simulateSendNotification,
  acknowledgeNotification,
  retryNotification,
  generateRiskAlertNotifications,
  generateRebookingInitiatedNotifications,
  generateRebookingCompletedNotifications,
  generateEventCancelledNotifications,
  queryNotifications
} from './services/notificationService';
import * as crypto from 'crypto';

function generateNumber(prefix: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

function createSuccessResponse<T>(data: T, requestId: string): ApiResponse<T> {
  return {
    success: true,
    data,
    requestId,
    timestamp: new Date().toISOString()
  };
}

function createErrorResponse(code: string, message: string, requestId: string, details?: any): ApiResponse {
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

function recordProblem(
  operationType: OperationType,
  requestId: string,
  errorType: string,
  errorMessage: string,
  requestData: any,
  source: string
): ProblemRecord {
  const problem: ProblemRecord = {
    problemId: uuidv4(),
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
  return storage.createProblem(problem);
}

function hashInput(input: any): string {
  return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function checkIdempotency(requestId: string, operationType: OperationType, input: any): { isDuplicate: boolean; cachedResult?: ApiResponse } {
  storage.cleanupExpiredRecords();
  
  const existing = storage.getIdempotentRecord(requestId);
  if (existing && existing.operationType === operationType) {
    return {
      isDuplicate: true,
      cachedResult: existing.result
    };
  }
  
  return { isDuplicate: false };
}

function recordIdempotency(requestId: string, operationType: OperationType, input: any, result: ApiResponse): void {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  storage.createIdempotentRecord({
    requestId,
    operationType,
    inputHash: hashInput(input),
    result,
    createdAt: new Date().toISOString(),
    expiresAt
  });
}

function validateRequiredFields(obj: any, fields: string[]): string | null {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

export function handleCreateRiskEvent(request: CreateRiskEventRequest): ApiResponse {
  const idempotencyCheck = checkIdempotency(request.requestId, 'CREATE_EVENT', request);
  if (idempotencyCheck.isDuplicate) {
    return idempotencyCheck.cachedResult!;
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
    const event: RiskEvent = {
      eventId: uuidv4(),
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

    storage.createEvent(event);

    const allSites = storage.getAllSites();
    const assessedSites: AssessedSite[] = [];
    const affectedOrderIds: string[] = [];

    for (const site of allSites) {
      const assessedRiskLevel = assessSiteRisk(site, event.weatherAlert);
      const actionRequired = getActionRequired(assessedRiskLevel);
      
      const assessedSite: AssessedSite = {
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
        const orders = storage.getOrdersBySite(site.siteId);
        affectedOrderIds.push(...orders.map(o => o.orderId));
      }
    }

    event.assessedSites = assessedSites;
    event.affectedOrders = [...new Set(affectedOrderIds)];
    storage.updateEvent(event);

    const notifications = generateRiskAlertNotifications(event);
    for (const notification of notifications) {
      simulateSendNotification(notification.notificationId);
    }

    const response = createSuccessResponse({
      ...event,
      notificationsGenerated: notifications.length
    }, request.requestId);
    recordIdempotency(request.requestId, 'CREATE_EVENT', request, response);
    return response;

  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error occurred';
    const response = createErrorResponse('SYSTEM_ERROR', errorMessage, request.requestId, { error: error.stack });
    recordProblem('CREATE_EVENT', request.requestId, 'SYSTEM_ERROR', errorMessage, request, request.source);
    recordIdempotency(request.requestId, 'CREATE_EVENT', request, response);
    return response;
  }
}

export function handleAssessSite(request: AssessSiteRequest): ApiResponse {
  const idempotencyCheck = checkIdempotency(request.requestId, 'ASSESS_SITES', request);
  if (idempotencyCheck.isDuplicate) {
    return idempotencyCheck.cachedResult!;
  }

  const validationError = validateRequiredFields(request, ['requestId', 'eventId', 'siteId', 'assessedRiskLevel', 'source']);
  if (validationError) {
    const response = createErrorResponse('VALIDATION_ERROR', validationError, request.requestId, request);
    recordProblem('ASSESS_SITES', request.requestId, 'VALIDATION_ERROR', validationError, request, request.source);
    recordIdempotency(request.requestId, 'ASSESS_SITES', request, response);
    return response;
  }

  try {
    const event = storage.getEvent(request.eventId);
    if (!event) {
      const response = createErrorResponse('EVENT_NOT_FOUND', `Risk event not found: ${request.eventId}`, request.requestId, request);
      recordProblem('ASSESS_SITES', request.requestId, 'EVENT_NOT_FOUND', response.error!.message, request, request.source);
      recordIdempotency(request.requestId, 'ASSESS_SITES', request, response);
      return response;
    }

    if (event.status !== 'ACTIVE' && event.status !== 'PROCESSING') {
      const response = createErrorResponse('INVALID_EVENT_STATUS', `Event is not in ACTIVE or PROCESSING status: ${event.status}`, request.requestId, request);
      recordProblem('ASSESS_SITES', request.requestId, 'INVALID_EVENT_STATUS', response.error!.message, request, request.source);
      recordIdempotency(request.requestId, 'ASSESS_SITES', request, response);
      return response;
    }

    const site = storage.getSite(request.siteId);
    if (!site) {
      const response = createErrorResponse('SITE_NOT_FOUND', `Site not found: ${request.siteId}`, request.requestId, request);
      recordProblem('ASSESS_SITES', request.requestId, 'SITE_NOT_FOUND', response.error!.message, request, request.source);
      recordIdempotency(request.requestId, 'ASSESS_SITES', request, response);
      return response;
    }

    const validRiskLevels: RiskLevel[] = ['NO_RISK', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (!validRiskLevels.includes(request.assessedRiskLevel)) {
      const response = createErrorResponse('INVALID_RISK_LEVEL', `Invalid risk level: ${request.assessedRiskLevel}`, request.requestId, request);
      recordProblem('ASSESS_SITES', request.requestId, 'INVALID_RISK_LEVEL', response.error!.message, request, request.source);
      recordIdempotency(request.requestId, 'ASSESS_SITES', request, response);
      return response;
    }

    const now = new Date().toISOString();
    const actionRequired = getActionRequired(request.assessedRiskLevel);
    
    const updatedAssessedSite: AssessedSite = {
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
    } else {
      event.assessedSites.push(updatedAssessedSite);
    }

    site.riskLevel = request.assessedRiskLevel;
    storage.updateSite(site);

    if (actionRequired === 'EVACUATE' || actionRequired === 'REASSIGN') {
      const orders = storage.getOrdersBySite(site.siteId);
      const newOrderIds = orders.map(o => o.orderId);
      event.affectedOrders = [...new Set([...event.affectedOrders, ...newOrderIds])];
    }

    event.updatedAt = now;
    storage.updateEvent(event);

    const response = createSuccessResponse({
      eventId: event.eventId,
      siteId: site.siteId,
      newRiskLevel: request.assessedRiskLevel,
      actionRequired,
      eventStatus: event.status
    }, request.requestId);

    recordIdempotency(request.requestId, 'ASSESS_SITES', request, response);
    return response;

  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error occurred';
    const response = createErrorResponse('SYSTEM_ERROR', errorMessage, request.requestId, { error: error.stack });
    recordProblem('ASSESS_SITES', request.requestId, 'SYSTEM_ERROR', errorMessage, request, request.source);
    recordIdempotency(request.requestId, 'ASSESS_SITES', request, response);
    return response;
  }
}

export function handleCreateRebooking(request: CreateRebookingRequest): ApiResponse {
  const idempotencyCheck = checkIdempotency(request.requestId, 'CREATE_REBOOKING', request);
  if (idempotencyCheck.isDuplicate) {
    return idempotencyCheck.cachedResult!;
  }

  const validationError = validateRequiredFields(request, ['requestId', 'eventId', 'orderId', 'reason', 'source']);
  if (validationError) {
    const response = createErrorResponse('VALIDATION_ERROR', validationError, request.requestId, request);
    recordProblem('CREATE_REBOOKING', request.requestId, 'VALIDATION_ERROR', validationError, request, request.source);
    recordIdempotency(request.requestId, 'CREATE_REBOOKING', request, response);
    return response;
  }

  try {
    const event = storage.getEvent(request.eventId);
    if (!event) {
      const response = createErrorResponse('EVENT_NOT_FOUND', `Risk event not found: ${request.eventId}`, request.requestId, request);
      recordProblem('CREATE_REBOOKING', request.requestId, 'EVENT_NOT_FOUND', response.error!.message, request, request.source);
      recordIdempotency(request.requestId, 'CREATE_REBOOKING', request, response);
      return response;
    }

    if (event.status !== 'ACTIVE' && event.status !== 'PROCESSING') {
      const response = createErrorResponse('INVALID_EVENT_STATUS', `Event is not in ACTIVE or PROCESSING status: ${event.status}`, request.requestId, request);
      recordProblem('CREATE_REBOOKING', request.requestId, 'INVALID_EVENT_STATUS', response.error!.message, request, request.source);
      recordIdempotency(request.requestId, 'CREATE_REBOOKING', request, response);
      return response;
    }

    const order = storage.getOrder(request.orderId);
    if (!order) {
      const response = createErrorResponse('ORDER_NOT_FOUND', `Order not found: ${request.orderId}`, request.requestId, request);
      recordProblem('CREATE_REBOOKING', request.requestId, 'ORDER_NOT_FOUND', response.error!.message, request, request.source);
      recordIdempotency(request.requestId, 'CREATE_REBOOKING', request, response);
      return response;
    }

    if (!['CONFIRMED', 'CHECKED_IN'].includes(order.status)) {
      const response = createErrorResponse('INVALID_ORDER_STATUS', `Order is not in CONFIRMED or CHECKED_IN status: ${order.status}`, request.requestId, request);
      recordProblem('CREATE_REBOOKING', request.requestId, 'INVALID_ORDER_STATUS', response.error!.message, request, request.source);
      recordIdempotency(request.requestId, 'CREATE_REBOOKING', request, response);
      return response;
    }

    const existingRebookings = storage.getRebookingsByEvent(event.eventId);
    const existingRebook = existingRebookings.find(r => r.originalOrderId === order.orderId && r.status !== 'COMPLETED' && r.status !== 'CANCELLED');
    if (existingRebook) {
      const response = createErrorResponse('REBOOKING_EXISTS', `A rebooking already exists for this order: ${existingRebook.rebookingId}`, request.requestId, request);
      recordProblem('CREATE_REBOOKING', request.requestId, 'REBOOKING_EXISTS', response.error!.message, request, request.source);
      recordIdempotency(request.requestId, 'CREATE_REBOOKING', request, response);
      return response;
    }

    const availableSites = findAvailableReplacementSites(order.siteId);

    const now = new Date().toISOString();
    const rebooking: Rebooking = {
      rebookingId: uuidv4(),
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

    storage.createRebooking(rebooking);

    event.rebookings.push(rebooking.rebookingId);
    event.updatedAt = now;
    event.status = 'PROCESSING';
    storage.updateEvent(event);

    order.status = 'REBOOKING';
    storage.updateOrder(order);

    const rebookingNotifications = generateRebookingInitiatedNotifications(
      event,
      rebooking.rebookingId,
      order,
      availableSites.length
    );
    for (const notification of rebookingNotifications) {
      simulateSendNotification(notification.notificationId);
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

  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error occurred';
    const response = createErrorResponse('SYSTEM_ERROR', errorMessage, request.requestId, { error: error.stack });
    recordProblem('CREATE_REBOOKING', request.requestId, 'SYSTEM_ERROR', errorMessage, request, request.source);
    recordIdempotency(request.requestId, 'CREATE_REBOOKING', request, response);
    return response;
  }
}

export function handleProcessRebooking(request: ProcessRebookingRequest): ApiResponse {
  const idempotencyCheck = checkIdempotency(request.requestId, 'PROCESS_REBOOKING', request);
  if (idempotencyCheck.isDuplicate) {
    return idempotencyCheck.cachedResult!;
  }

  const validationError = validateRequiredFields(request, ['requestId', 'rebookingId', 'targetSiteId', 'source']);
  if (validationError) {
    const response = createErrorResponse('VALIDATION_ERROR', validationError, request.requestId, request);
    recordProblem('PROCESS_REBOOKING', request.requestId, 'VALIDATION_ERROR', validationError, request, request.source);
    recordIdempotency(request.requestId, 'PROCESS_REBOOKING', request, response);
    return response;
  }

  try {
    const rebooking = storage.getRebooking(request.rebookingId);
    if (!rebooking) {
      const response = createErrorResponse('REBOOKING_NOT_FOUND', `Rebooking not found: ${request.rebookingId}`, request.requestId, request);
      recordProblem('PROCESS_REBOOKING', request.requestId, 'REBOOKING_NOT_FOUND', response.error!.message, request, request.source);
      recordIdempotency(request.requestId, 'PROCESS_REBOOKING', request, response);
      return response;
    }

    if (rebooking.status !== 'PENDING') {
      const response = createErrorResponse('INVALID_REBOOKING_STATUS', `Rebooking is not in PENDING status: ${rebooking.status}`, request.requestId, request);
      recordProblem('PROCESS_REBOOKING', request.requestId, 'INVALID_REBOOKING_STATUS', response.error!.message, request, request.source);
      recordIdempotency(request.requestId, 'PROCESS_REBOOKING', request, response);
      return response;
    }

    const targetSite = storage.getSite(request.targetSiteId);
    if (!targetSite) {
      const response = createErrorResponse('SITE_NOT_FOUND', `Target site not found: ${request.targetSiteId}`, request.requestId, request);
      recordProblem('PROCESS_REBOOKING', request.requestId, 'SITE_NOT_FOUND', response.error!.message, request, request.source);
      recordIdempotency(request.requestId, 'PROCESS_REBOOKING', request, response);
      return response;
    }

    if (!isSiteReassignable(targetSite.siteId)) {
      const response = createErrorResponse('SITE_NOT_AVAILABLE', `Target site is not available for rebooking: ${targetSite.siteNumber}`, request.requestId, request);
      recordProblem('PROCESS_REBOOKING', request.requestId, 'SITE_NOT_AVAILABLE', response.error!.message, request, request.source);
      recordIdempotency(request.requestId, 'PROCESS_REBOOKING', request, response);
      return response;
    }

    const order = storage.getOrder(rebooking.originalOrderId);
    if (!order) {
      const response = createErrorResponse('ORDER_NOT_FOUND', `Original order not found: ${rebooking.originalOrderId}`, request.requestId, request);
      recordProblem('PROCESS_REBOOKING', request.requestId, 'ORDER_NOT_FOUND', response.error!.message, request, request.source);
      recordIdempotency(request.requestId, 'PROCESS_REBOOKING', request, response);
      return response;
    }

    const originalSite = storage.getSite(rebooking.originalSiteId);
    if (!originalSite) {
      const response = createErrorResponse('SITE_NOT_FOUND', `Original site not found: ${rebooking.originalSiteId}`, request.requestId, request);
      recordProblem('PROCESS_REBOOKING', request.requestId, 'SITE_NOT_FOUND', response.error!.message, request, request.source);
      recordIdempotency(request.requestId, 'PROCESS_REBOOKING', request, response);
      return response;
    }

    const now = new Date().toISOString();
    const lockId = uuidv4();
    const lock: ResourceLock = {
      lockId,
      siteId: targetSite.siteId,
      lockType: 'REBOOKING',
      lockedBy: rebooking.rebookingId,
      lockedAt: now,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      reason: `Locked for rebooking ${rebooking.rebookingNumber}`,
      isActive: true
    };
    storage.createLock(lock);

    targetSite.isLocked = true;
    targetSite.lockedBy = lockId;
    storage.updateSite(targetSite);

    originalSite.isOccupied = false;
    originalSite.isLocked = false;
    originalSite.lockedBy = null;
    storage.updateSite(originalSite);

    order.siteId = targetSite.siteId;
    order.status = 'REBOOKED';
    storage.updateOrder(order);

    targetSite.isOccupied = true;
    targetSite.isLocked = false;
    targetSite.lockedBy = null;
    storage.updateSite(targetSite);

    lock.isActive = false;
    storage.updateLock(lock);

    rebooking.targetSiteId = targetSite.siteId;
    rebooking.status = 'COMPLETED';
    rebooking.updatedAt = now;
    rebooking.completedAt = now;
    storage.updateRebooking(rebooking);

    const event = storage.getEvent(rebooking.eventId);
    if (event) {
      const remainingRebookings = event.rebookings
        .map(rid => storage.getRebooking(rid))
        .filter(r => r && ['PENDING', 'IN_PROGRESS'].includes(r.status));
      
      if (remainingRebookings.length === 0) {
        event.status = 'RESOLVED';
        event.updatedAt = now;
        storage.updateEvent(event);
      }
    }

    let completedNotifications: number = 0;
    if (event) {
      const completeNotifications = generateRebookingCompletedNotifications(
        event,
        rebooking.rebookingId,
        order,
        originalSite.siteNumber,
        targetSite.siteNumber
      );
      for (const notification of completeNotifications) {
        simulateSendNotification(notification.notificationId);
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

  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error occurred';
    const response = createErrorResponse('SYSTEM_ERROR', errorMessage, request.requestId, { error: error.stack });
    recordProblem('PROCESS_REBOOKING', request.requestId, 'SYSTEM_ERROR', errorMessage, request, request.source);
    recordIdempotency(request.requestId, 'PROCESS_REBOOKING', request, response);
    return response;
  }
}

export function handleCancelEvent(request: CancelEventRequest): ApiResponse {
  const idempotencyCheck = checkIdempotency(request.requestId, 'CANCEL_EVENT', request);
  if (idempotencyCheck.isDuplicate) {
    return idempotencyCheck.cachedResult!;
  }

  const validationError = validateRequiredFields(request, ['requestId', 'eventId', 'reason', 'source']);
  if (validationError) {
    const response = createErrorResponse('VALIDATION_ERROR', validationError, request.requestId, request);
    recordProblem('CANCEL_EVENT', request.requestId, 'VALIDATION_ERROR', validationError, request, request.source);
    recordIdempotency(request.requestId, 'CANCEL_EVENT', request, response);
    return response;
  }

  try {
    const event = storage.getEvent(request.eventId);
    if (!event) {
      const response = createErrorResponse('EVENT_NOT_FOUND', `Risk event not found: ${request.eventId}`, request.requestId, request);
      recordProblem('CANCEL_EVENT', request.requestId, 'EVENT_NOT_FOUND', response.error!.message, request, request.source);
      recordIdempotency(request.requestId, 'CANCEL_EVENT', request, response);
      return response;
    }

    if (event.status === 'RESOLVED' || event.status === 'CANCELLED') {
      const response = createErrorResponse('INVALID_EVENT_STATUS', `Event already in ${event.status} status`, request.requestId, request);
      recordProblem('CANCEL_EVENT', request.requestId, 'INVALID_EVENT_STATUS', response.error!.message, request, request.source);
      recordIdempotency(request.requestId, 'CANCEL_EVENT', request, response);
      return response;
    }

    const pendingRebookings = storage.getRebookingsByEvent(event.eventId)
      .filter(r => ['PENDING', 'IN_PROGRESS'].includes(r.status));

    if (pendingRebookings.length > 0) {
      const response = createErrorResponse('PENDING_REBOOKINGS', `There are ${pendingRebookings.length} pending rebookings. Cancel those first.`, request.requestId, request);
      recordProblem('CANCEL_EVENT', request.requestId, 'PENDING_REBOOKINGS', response.error!.message, request, request.source);
      recordIdempotency(request.requestId, 'CANCEL_EVENT', request, response);
      return response;
    }

    const now = new Date().toISOString();

    for (const site of event.assessedSites) {
      const dbSite = storage.getSite(site.siteId);
      if (dbSite) {
        dbSite.riskLevel = site.originalRiskLevel;
        storage.updateSite(dbSite);
      }
    }

    for (const rid of event.rebookings) {
      const rebooking = storage.getRebooking(rid);
      if (rebooking && rebooking.status === 'PENDING') {
        rebooking.status = 'CANCELLED';
        rebooking.updatedAt = now;
        storage.updateRebooking(rebooking);

        const order = storage.getOrder(rebooking.originalOrderId);
        if (order && order.status === 'REBOOKING') {
          order.status = 'CONFIRMED';
          storage.updateOrder(order);
        }
      }
    }

    event.status = 'CANCELLED';
    event.updatedAt = now;
    storage.updateEvent(event);

    const cancelNotifications = generateEventCancelledNotifications(event);
    for (const notification of cancelNotifications) {
      simulateSendNotification(notification.notificationId);
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

  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error occurred';
    const response = createErrorResponse('SYSTEM_ERROR', errorMessage, request.requestId, { error: error.stack });
    recordProblem('CANCEL_EVENT', request.requestId, 'SYSTEM_ERROR', errorMessage, request, request.source);
    recordIdempotency(request.requestId, 'CANCEL_EVENT', request, response);
    return response;
  }
}

export function handleModifyEvent(request: ModifyEventRequest): ApiResponse {
  const idempotencyCheck = checkIdempotency(request.requestId, 'MODIFY_EVENT', request);
  if (idempotencyCheck.isDuplicate) {
    return idempotencyCheck.cachedResult!;
  }

  const validationError = validateRequiredFields(request, ['requestId', 'eventId', 'updates', 'source']);
  if (validationError) {
    const response = createErrorResponse('VALIDATION_ERROR', validationError, request.requestId, request);
    recordProblem('MODIFY_EVENT', request.requestId, 'VALIDATION_ERROR', validationError, request, request.source);
    recordIdempotency(request.requestId, 'MODIFY_EVENT', request, response);
    return response;
  }

  try {
    const event = storage.getEvent(request.eventId);
    if (!event) {
      const response = createErrorResponse('EVENT_NOT_FOUND', `Risk event not found: ${request.eventId}`, request.requestId, request);
      recordProblem('MODIFY_EVENT', request.requestId, 'EVENT_NOT_FOUND', response.error!.message, request, request.source);
      recordIdempotency(request.requestId, 'MODIFY_EVENT', request, response);
      return response;
    }

    const allowedStatuses: RiskEventStatus[] = ['DRAFT', 'ACTIVE', 'PROCESSING', 'RESOLVED', 'CANCELLED'];
    if (request.updates.status && !allowedStatuses.includes(request.updates.status)) {
      const response = createErrorResponse('INVALID_STATUS', `Invalid status: ${request.updates.status}`, request.requestId, request);
      recordProblem('MODIFY_EVENT', request.requestId, 'INVALID_STATUS', response.error!.message, request, request.source);
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
    storage.updateEvent(event);

    const response = createSuccessResponse({
      eventId: event.eventId,
      eventNumber: event.eventNumber,
      originalStatus,
      newStatus: event.status
    }, request.requestId);

    recordIdempotency(request.requestId, 'MODIFY_EVENT', request, response);
    return response;

  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error occurred';
    const response = createErrorResponse('SYSTEM_ERROR', errorMessage, request.requestId, { error: error.stack });
    recordProblem('MODIFY_EVENT', request.requestId, 'SYSTEM_ERROR', errorMessage, request, request.source);
    recordIdempotency(request.requestId, 'MODIFY_EVENT', request, response);
    return response;
  }
}

export function handleQuerySummary(request: QuerySummaryRequest): ApiResponse {
  const requestId = uuidv4();
  storage.cleanupExpiredRecords();

  try {
    let events = storage.getAllEvents();
    
    if (request.eventId) {
      const event = storage.getEvent(request.eventId);
      events = event ? [event] : [];
    }
    
    if (request.status) {
      events = events.filter(e => e.status === request.status);
    }

    const summary = events.map(event => {
      const rebookings = storage.getRebookingsByEvent(event.eventId);
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

  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error occurred';
    return createErrorResponse('SYSTEM_ERROR', errorMessage, requestId, { error: error.stack });
  }
}

export function handleQueryProblems(): ApiResponse {
  const requestId = uuidv4();
  storage.cleanupExpiredRecords();

  try {
    const problems = storage.getProblems();
    return createSuccessResponse({
      total: problems.length,
      open: problems.filter(p => p.status === 'OPEN').length,
      problems
    }, requestId);
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error occurred';
    return createErrorResponse('SYSTEM_ERROR', errorMessage, requestId, { error: error.stack });
  }
}

export function handleQuerySites(): ApiResponse {
  const requestId = uuidv4();
  try {
    const sites = storage.getAllSites();
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
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error occurred';
    return createErrorResponse('SYSTEM_ERROR', errorMessage, requestId, { error: error.stack });
  }
}

export function handleQueryOrders(): ApiResponse {
  const requestId = uuidv4();
  try {
    const orders = storage.getAllOrders();
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
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error occurred';
    return createErrorResponse('SYSTEM_ERROR', errorMessage, requestId, { error: error.stack });
  }
}

export function handleCreateNotification(request: CreateNotificationRequest): ApiResponse {
  const idempotencyCheck = checkIdempotency(request.requestId, 'SEND_NOTIFICATION', request);
  if (idempotencyCheck.isDuplicate) {
    return idempotencyCheck.cachedResult!;
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
    const notification = createNotificationService({
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

    const sendResult = simulateSendNotification(notification.notificationId);

    const response = createSuccessResponse({
      notificationId: notification.notificationId,
      notificationNumber: notification.notificationNumber,
      status: notification.status,
      sent: sendResult.success,
      sendError: sendResult.error
    }, request.requestId);

    recordIdempotency(request.requestId, 'SEND_NOTIFICATION', request, response);
    return response;

  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error occurred';
    const response = createErrorResponse('SYSTEM_ERROR', errorMessage, request.requestId, { error: error.stack });
    recordProblem('SEND_NOTIFICATION', request.requestId, 'SYSTEM_ERROR', errorMessage, request, request.source);
    recordIdempotency(request.requestId, 'SEND_NOTIFICATION', request, response);
    return response;
  }
}

export function handleSendNotification(request: SendNotificationRequest): ApiResponse {
  const idempotencyCheck = checkIdempotency(request.requestId, 'SEND_NOTIFICATION', request);
  if (idempotencyCheck.isDuplicate) {
    return idempotencyCheck.cachedResult!;
  }

  const validationError = validateRequiredFields(request, ['requestId', 'notificationId', 'source']);
  if (validationError) {
    const response = createErrorResponse('VALIDATION_ERROR', validationError, request.requestId, request);
    recordProblem('SEND_NOTIFICATION', request.requestId, 'VALIDATION_ERROR', validationError, request, request.source);
    recordIdempotency(request.requestId, 'SEND_NOTIFICATION', request, response);
    return response;
  }

  try {
    const notification = storage.getNotification(request.notificationId);
    if (!notification) {
      const response = createErrorResponse('NOTIFICATION_NOT_FOUND', `Notification not found: ${request.notificationId}`, request.requestId, request);
      recordProblem('SEND_NOTIFICATION', request.requestId, 'NOTIFICATION_NOT_FOUND', response.error!.message, request, request.source);
      recordIdempotency(request.requestId, 'SEND_NOTIFICATION', request, response);
      return response;
    }

    if (['CANCELLED', 'ACKNOWLEDGED'].includes(notification.status)) {
      const response = createErrorResponse('INVALID_NOTIFICATION_STATUS', `Cannot send notification in ${notification.status} status`, request.requestId, request);
      recordProblem('SEND_NOTIFICATION', request.requestId, 'INVALID_NOTIFICATION_STATUS', response.error!.message, request, request.source);
      recordIdempotency(request.requestId, 'SEND_NOTIFICATION', request, response);
      return response;
    }

    const sendResult = simulateSendNotification(notification.notificationId);
    const updatedNotification = storage.getNotification(notification.notificationId);

    const response = createSuccessResponse({
      notificationId: notification.notificationId,
      status: updatedNotification?.status,
      sent: sendResult.success,
      sendError: sendResult.error
    }, request.requestId);

    recordIdempotency(request.requestId, 'SEND_NOTIFICATION', request, response);
    return response;

  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error occurred';
    const response = createErrorResponse('SYSTEM_ERROR', errorMessage, request.requestId, { error: error.stack });
    recordProblem('SEND_NOTIFICATION', request.requestId, 'SYSTEM_ERROR', errorMessage, request, request.source);
    recordIdempotency(request.requestId, 'SEND_NOTIFICATION', request, response);
    return response;
  }
}

export function handleAcknowledgeNotification(request: AcknowledgeNotificationRequest): ApiResponse {
  const idempotencyCheck = checkIdempotency(request.requestId, 'ACK_NOTIFICATION', request);
  if (idempotencyCheck.isDuplicate) {
    return idempotencyCheck.cachedResult!;
  }

  const validationError = validateRequiredFields(request, ['requestId', 'notificationId', 'acknowledgedBy', 'source']);
  if (validationError) {
    const response = createErrorResponse('VALIDATION_ERROR', validationError, request.requestId, request);
    recordProblem('ACK_NOTIFICATION', request.requestId, 'VALIDATION_ERROR', validationError, request, request.source);
    recordIdempotency(request.requestId, 'ACK_NOTIFICATION', request, response);
    return response;
  }

  try {
    const notification = storage.getNotification(request.notificationId);
    if (!notification) {
      const response = createErrorResponse('NOTIFICATION_NOT_FOUND', `Notification not found: ${request.notificationId}`, request.requestId, request);
      recordProblem('ACK_NOTIFICATION', request.requestId, 'NOTIFICATION_NOT_FOUND', response.error!.message, request, request.source);
      recordIdempotency(request.requestId, 'ACK_NOTIFICATION', request, response);
      return response;
    }

    if (!['SENT', 'DELIVERED'].includes(notification.status)) {
      const response = createErrorResponse('INVALID_NOTIFICATION_STATUS', `Can only acknowledge SENT or DELIVERED notifications, current: ${notification.status}`, request.requestId, request);
      recordProblem('ACK_NOTIFICATION', request.requestId, 'INVALID_NOTIFICATION_STATUS', response.error!.message, request, request.source);
      recordIdempotency(request.requestId, 'ACK_NOTIFICATION', request, response);
      return response;
    }

    const updated = acknowledgeNotification(notification.notificationId, request.acknowledgedBy, request.note);

    if (!updated) {
      const response = createErrorResponse('ACKNOWLEDGE_FAILED', 'Failed to acknowledge notification', request.requestId, request);
      recordProblem('ACK_NOTIFICATION', request.requestId, 'ACKNOWLEDGE_FAILED', response.error!.message, request, request.source);
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

  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error occurred';
    const response = createErrorResponse('SYSTEM_ERROR', errorMessage, request.requestId, { error: error.stack });
    recordProblem('ACK_NOTIFICATION', request.requestId, 'SYSTEM_ERROR', errorMessage, request, request.source);
    recordIdempotency(request.requestId, 'ACK_NOTIFICATION', request, response);
    return response;
  }
}

export function handleRetryNotification(request: RetryNotificationRequest): ApiResponse {
  const idempotencyCheck = checkIdempotency(request.requestId, 'RETRY_NOTIFICATION', request);
  if (idempotencyCheck.isDuplicate) {
    return idempotencyCheck.cachedResult!;
  }

  const validationError = validateRequiredFields(request, ['requestId', 'notificationId', 'source']);
  if (validationError) {
    const response = createErrorResponse('VALIDATION_ERROR', validationError, request.requestId, request);
    recordProblem('RETRY_NOTIFICATION', request.requestId, 'VALIDATION_ERROR', validationError, request, request.source);
    recordIdempotency(request.requestId, 'RETRY_NOTIFICATION', request, response);
    return response;
  }

  try {
    const notification = storage.getNotification(request.notificationId);
    if (!notification) {
      const response = createErrorResponse('NOTIFICATION_NOT_FOUND', `Notification not found: ${request.notificationId}`, request.requestId, request);
      recordProblem('RETRY_NOTIFICATION', request.requestId, 'NOTIFICATION_NOT_FOUND', response.error!.message, request, request.source);
      recordIdempotency(request.requestId, 'RETRY_NOTIFICATION', request, response);
      return response;
    }

    if (notification.status !== 'FAILED') {
      const response = createErrorResponse('INVALID_NOTIFICATION_STATUS', `Can only retry FAILED notifications, current: ${notification.status}`, request.requestId, request);
      recordProblem('RETRY_NOTIFICATION', request.requestId, 'INVALID_NOTIFICATION_STATUS', response.error!.message, request, request.source);
      recordIdempotency(request.requestId, 'RETRY_NOTIFICATION', request, response);
      return response;
    }

    if (notification.retryCount >= notification.maxRetries) {
      const response = createErrorResponse('MAX_RETRIES_EXCEEDED', `Maximum retries exceeded: ${notification.retryCount}/${notification.maxRetries}`, request.requestId, request);
      recordProblem('RETRY_NOTIFICATION', request.requestId, 'MAX_RETRIES_EXCEEDED', response.error!.message, request, request.source);
      recordIdempotency(request.requestId, 'RETRY_NOTIFICATION', request, response);
      return response;
    }

    const retried = retryNotification(notification.notificationId);

    if (!retried) {
      const response = createErrorResponse('RETRY_FAILED', 'Failed to retry notification', request.requestId, request);
      recordProblem('RETRY_NOTIFICATION', request.requestId, 'RETRY_FAILED', response.error!.message, request, request.source);
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

  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error occurred';
    const response = createErrorResponse('SYSTEM_ERROR', errorMessage, request.requestId, { error: error.stack });
    recordProblem('RETRY_NOTIFICATION', request.requestId, 'SYSTEM_ERROR', errorMessage, request, request.source);
    recordIdempotency(request.requestId, 'RETRY_NOTIFICATION', request, response);
    return response;
  }
}

export function handleQueryNotifications(request: QueryNotificationsRequest): ApiResponse {
  const requestId = uuidv4();
  storage.cleanupExpiredRecords();

  try {
    const notifications = queryNotifications({
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

  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error occurred';
    return createErrorResponse('SYSTEM_ERROR', errorMessage, requestId, { error: error.stack });
  }
}
