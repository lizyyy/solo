const moment = require('moment');
const Request = require('../models/Request');
const { RequestRepository, BatchRepository, ChemicalRepository, AuditLogRepository } = require('../storage/repositories');
const { PermissionValidator } = require('../validation/PermissionValidator');
const { StockValidator } = require('../validation/StockValidator');
const { ExpiryValidator } = require('../validation/ExpiryValidator');
const { DangerLevelValidator } = require('../validation/DangerLevelValidator');
const { RequestDuplicateValidator } = require('../validation/DuplicateSubmitValidator');
const { RequestStateMachine, StateTransitionError } = require('../state-machine/RequestStateMachine');
const AuditLog = require('../models/AuditLog');
const config = require('../config');

class RequestService {
  constructor() {
    this.requestRepository = new RequestRepository();
    this.batchRepository = new BatchRepository();
    this.chemicalRepository = new ChemicalRepository();
    this.auditLogRepository = new AuditLogRepository();
  }

  async createRequest(data, user) {
    PermissionValidator.checkPermission(user.role, 'create_request');
    
    const validationErrors = Request.validate(data);
    if (validationErrors.length > 0) {
      const error = new Error(validationErrors[0]);
      error.status = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    
    const batch = await this.batchRepository.findById(data.batch_id);
    if (!batch) {
      const error = new Error(`批次不存在: ${data.batch_id}`);
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }
    
    const chemical = await this.chemicalRepository.findById(data.chemical_id);
    if (!chemical) {
      const error = new Error(`试剂不存在: ${data.chemical_id}`);
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }
    
    if (batch.chemical_id !== data.chemical_id) {
      const error = new Error('批次与试剂不匹配');
      error.status = 400;
      error.code = 'BATCH_CHEMICAL_MISMATCH';
      throw error;
    }
    
    ExpiryValidator.validateNotExpired(batch.expiry_date, `试剂 [${chemical.name}] 批次 [${batch.batch_number}]`);
    
    StockValidator.validateBatchActive(batch.status);
    
    await RequestDuplicateValidator.checkDuplicateRequest(
      this.requestRepository,
      data.requester_id,
      data.chemical_id,
      data.batch_id,
      data.quantity
    );
    
    const request = new Request({
      ...data,
      unit: data.unit || batch.unit,
      status: config.request_status.draft,
      created_by: user.id,
      updated_by: user.id
    });
    
    const createdRequest = await this.requestRepository.create(request);
    
    await this.auditLogRepository.logAction({
      action: AuditLog.actions.REQUEST_CREATE,
      entity_type: AuditLog.entityTypes.REQUEST,
      entity_id: createdRequest.id,
      entity_name: createdRequest.request_number,
      description: `创建领用申请: ${createdRequest.request_number}`,
      new_value: createdRequest.toJSON(),
      user_id: user.id,
      user_role: user.role
    });
    
    return this.enrichRequest(createdRequest, chemical, batch);
  }

  async submitRequest(requestId, user) {
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      const error = new Error(`申请不存在: ${requestId}`);
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }
    
    const batch = await this.batchRepository.findById(request.batch_id);
    if (!batch) {
      const error = new Error(`批次不存在: ${request.batch_id}`);
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }
    
    const chemical = await this.chemicalRepository.findById(request.chemical_id);
    
    StockValidator.validateSufficientStock(batch.current_quantity, request.quantity);
    
    const updatedRequest = RequestStateMachine.transition(request, 'submit', {
      userId: user.id
    });
    
    await this.requestRepository.update(updatedRequest);
    
    await this.auditLogRepository.logAction({
      action: AuditLog.actions.REQUEST_SUBMIT,
      entity_type: AuditLog.entityTypes.REQUEST,
      entity_id: requestId,
      entity_name: updatedRequest.request_number,
      description: `提交领用申请: ${updatedRequest.request_number}`,
      user_id: user.id,
      user_role: user.role
    });
    
    return this.enrichRequest(updatedRequest, chemical, batch);
  }

  async approveRequest(requestId, user) {
    PermissionValidator.checkPermission(user.role, 'approve_request');
    
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      const error = new Error(`申请不存在: ${requestId}`);
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }
    
    const batch = await this.batchRepository.findById(request.batch_id);
    if (!batch) {
      const error = new Error(`批次不存在: ${request.batch_id}`);
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }
    
    const chemical = await this.chemicalRepository.findById(request.chemical_id);
    
    const updatedRequest = RequestStateMachine.transition(request, 'approve', {
      userId: user.id,
      userName: user.name || '安全员'
    });
    
    await this.requestRepository.update(updatedRequest);
    
    await this.auditLogRepository.logAction({
      action: AuditLog.actions.REQUEST_APPROVE,
      entity_type: AuditLog.entityTypes.REQUEST,
      entity_id: requestId,
      entity_name: updatedRequest.request_number,
      description: `批准领用申请: ${updatedRequest.request_number}`,
      user_id: user.id,
      user_role: user.role
    });
    
    return this.enrichRequest(updatedRequest, chemical, batch);
  }

  async rejectRequest(requestId, data, user) {
    PermissionValidator.checkPermission(user.role, 'reject_request');
    
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      const error = new Error(`申请不存在: ${requestId}`);
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }
    
    const batch = await this.batchRepository.findById(request.batch_id);
    const chemical = await this.chemicalRepository.findById(request.chemical_id);
    
    const updatedRequest = RequestStateMachine.transition(request, 'reject', {
      userId: user.id,
      userName: user.name || '安全员',
      reason: data.reason || '申请被驳回'
    });
    
    await this.requestRepository.update(updatedRequest);
    
    await this.auditLogRepository.logAction({
      action: AuditLog.actions.REQUEST_REJECT,
      entity_type: AuditLog.entityTypes.REQUEST,
      entity_id: requestId,
      entity_name: updatedRequest.request_number,
      description: `驳回领用申请: ${updatedRequest.request_number}`,
      user_id: user.id,
      user_role: user.role
    });
    
    return this.enrichRequest(updatedRequest, chemical, batch);
  }

  async executeRequest(requestId, user) {
    PermissionValidator.checkPermission(user.role, 'execute_request');
    
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      const error = new Error(`申请不存在: ${requestId}`);
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }
    
    const batch = await this.batchRepository.findById(request.batch_id);
    if (!batch) {
      const error = new Error(`批次不存在: ${request.batch_id}`);
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }
    
    const chemical = await this.chemicalRepository.findById(request.chemical_id);
    
    StockValidator.validateSufficientStock(batch.current_quantity, request.quantity);
    ExpiryValidator.validateNotExpired(batch.expiry_date, `试剂 [${chemical.name}]`);
    
    const updatedRequest = RequestStateMachine.transition(request, 'execute', {
      userId: user.id,
      userName: user.name || '管理员'
    });
    
    await this.batchRepository.deductStock(batch.id, request.quantity);
    await this.requestRepository.update(updatedRequest);
    
    await this.auditLogRepository.logAction({
      action: AuditLog.actions.REQUEST_EXECUTE,
      entity_type: AuditLog.entityTypes.REQUEST,
      entity_id: requestId,
      entity_name: updatedRequest.request_number,
      description: `执行领用申请: ${updatedRequest.request_number}，扣减库存 ${request.quantity} ${batch.unit}`,
      user_id: user.id,
      user_role: user.role
    });
    
    return this.enrichRequest(updatedRequest, chemical, batch);
  }

  async returnRequest(requestId, data, user) {
    PermissionValidator.checkPermission(user.role, 'return_chemical');
    
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      const error = new Error(`申请不存在: ${requestId}`);
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }
    
    const batch = await this.batchRepository.findById(request.batch_id);
    if (!batch) {
      const error = new Error(`批次不存在: ${request.batch_id}`);
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }
    
    const chemical = await this.chemicalRepository.findById(request.chemical_id);
    
    const returnQuantity = data.return_quantity || request.quantity;
    StockValidator.validateReturnQuantity(request.quantity, returnQuantity);
    
    const updatedRequest = RequestStateMachine.transition(request, 'return', {
      userId: user.id,
      returnQuantity: returnQuantity
    });
    
    await this.batchRepository.addStock(batch.id, returnQuantity);
    await this.requestRepository.update(updatedRequest);
    
    await this.auditLogRepository.logAction({
      action: AuditLog.actions.REQUEST_RETURN,
      entity_type: AuditLog.entityTypes.REQUEST,
      entity_id: requestId,
      entity_name: updatedRequest.request_number,
      description: `归还试剂: ${updatedRequest.request_number}，归还数量 ${returnQuantity} ${batch.unit}`,
      user_id: user.id,
      user_role: user.role
    });
    
    return this.enrichRequest(updatedRequest, chemical, batch);
  }

  async disposeRequest(requestId, data, user) {
    PermissionValidator.checkPermission(user.role, 'dispose_chemical');
    
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      const error = new Error(`申请不存在: ${requestId}`);
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }
    
    const batch = await this.batchRepository.findById(request.batch_id);
    const chemical = await this.chemicalRepository.findById(request.chemical_id);
    
    const updatedRequest = RequestStateMachine.transition(request, 'dispose', {
      userId: user.id,
      reason: data.reason || '试剂已报废'
    });
    
    await this.requestRepository.update(updatedRequest);
    
    await this.auditLogRepository.logAction({
      action: AuditLog.actions.REQUEST_DISPOSE,
      entity_type: AuditLog.entityTypes.REQUEST,
      entity_id: requestId,
      entity_name: updatedRequest.request_number,
      description: `报废试剂: ${updatedRequest.request_number}`,
      user_id: user.id,
      user_role: user.role
    });
    
    return this.enrichRequest(updatedRequest, chemical, batch);
  }

  async getRequestById(requestId, user) {
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      const error = new Error(`申请不存在: ${requestId}`);
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }
    
    const batch = await this.batchRepository.findById(request.batch_id);
    const chemical = await this.chemicalRepository.findById(request.chemical_id);
    
    return this.enrichRequest(request, chemical, batch);
  }

  async getRequests(options = {}, user) {
    const requests = await this.requestRepository.findAll(options);
    const total = await this.requestRepository.count(options);
    
    const enrichedRequests = [];
    for (const request of requests) {
      const batch = await this.batchRepository.findById(request.batch_id);
      const chemical = await this.chemicalRepository.findById(request.chemical_id);
      enrichedRequests.push(this.enrichRequest(request, chemical, batch));
    }
    
    return {
      data: enrichedRequests,
      pagination: {
        total,
        limit: options.limit || 100,
        offset: options.offset || 0
      }
    };
  }

  async getPendingRequests(user) {
    PermissionValidator.checkIsSafetyOfficer(user.role);
    
    const requests = await this.requestRepository.findPendingRequests();
    
    const enrichedRequests = [];
    for (const request of requests) {
      const batch = await this.batchRepository.findById(request.batch_id);
      const chemical = await this.chemicalRepository.findById(request.chemical_id);
      enrichedRequests.push(this.enrichRequest(request, chemical, batch));
    }
    
    return {
      data: enrichedRequests
    };
  }

  async getRequestStatusFlow() {
    return RequestStateMachine.getStateFlow();
  }

  async getAvailableActions(requestId, user) {
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      const error = new Error(`申请不存在: ${requestId}`);
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }
    
    const actions = RequestStateMachine.getAvailableActions(request.status);
    
    const allowedActions = actions.filter(action => {
      switch (action.action) {
        case 'submit':
          return PermissionValidator.canCreateRequest(user.role);
        case 'approve':
        case 'reject':
          return PermissionValidator.canApproveRequest(user.role);
        case 'execute':
          return PermissionValidator.canExecuteRequest(user.role);
        case 'return':
          return PermissionValidator.canReturnChemical(user.role);
        case 'dispose':
          return PermissionValidator.canDisposeChemical(user.role);
        default:
          return false;
      }
    });
    
    return {
      current_status: request.status,
      current_status_text: request.getStatusText(),
      available_actions: allowedActions
    };
  }

  enrichRequest(request, chemical, batch) {
    const requestJson = request.toJSON();
    requestJson.chemical = chemical?.toJSON() || null;
    requestJson.batch = batch?.toJSON() || null;
    return requestJson;
  }
}

module.exports = RequestService;
