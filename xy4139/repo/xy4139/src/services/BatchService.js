const moment = require('moment');
const Batch = require('../models/Batch');
const { BatchRepository, ChemicalRepository, AuditLogRepository } = require('../storage/repositories');
const { PermissionValidator } = require('../validation/PermissionValidator');
const { StockValidator } = require('../validation/StockValidator');
const { ExpiryValidator } = require('../validation/ExpiryValidator');
const { RequestDuplicateValidator } = require('../validation/DuplicateSubmitValidator');
const AuditLog = require('../models/AuditLog');
const config = require('../config');

class BatchService {
  constructor() {
    this.batchRepository = new BatchRepository();
    this.chemicalRepository = new ChemicalRepository();
    this.auditLogRepository = new AuditLogRepository();
  }

  async createBatch(data, user) {
    PermissionValidator.checkPermission(user.role, 'create_batch');
    
    const validationErrors = Batch.validate(data);
    if (validationErrors.length > 0) {
      const error = new Error(validationErrors[0]);
      error.status = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    
    ExpiryValidator.validateExpiryDate(data.expiry_date, data.production_date);
    ExpiryValidator.validateFutureExpiryDate(data.expiry_date);
    
    const chemical = await this.chemicalRepository.findById(data.chemical_id);
    if (!chemical) {
      const error = new Error(`试剂不存在: ${data.chemical_id}`);
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }
    
    await RequestDuplicateValidator.checkDuplicateBatchNumber(
      this.batchRepository,
      data.batch_number
    );
    
    const batch = new Batch({
      ...data,
      unit: data.unit || chemical.unit,
      created_by: user.id,
      updated_by: user.id
    });
    
    const createdBatch = await this.batchRepository.create(batch);
    
    await this.auditLogRepository.logAction({
      action: AuditLog.actions.BATCH_CREATE,
      entity_type: AuditLog.entityTypes.BATCH,
      entity_id: createdBatch.id,
      entity_name: `${chemical.name} - ${createdBatch.batch_number}`,
      description: `创建批次: ${chemical.name} (${createdBatch.batch_number})`,
      new_value: createdBatch.toJSON(),
      user_id: user.id,
      user_role: user.role
    });
    
    return createdBatch;
  }

  async updateBatch(id, data, user) {
    PermissionValidator.checkPermission(user.role, 'update_batch');
    
    const existingBatch = await this.batchRepository.findById(id);
    if (!existingBatch) {
      const error = new Error(`批次不存在: ${id}`);
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }
    
    if (data.expiry_date) {
      ExpiryValidator.validateExpiryDate(data.expiry_date, data.production_date || existingBatch.production_date);
    }
    
    if (data.batch_number && data.batch_number !== existingBatch.batch_number) {
      await RequestDuplicateValidator.checkDuplicateBatchNumber(
        this.batchRepository,
        data.batch_number
      );
    }
    
    const oldValue = existingBatch.toJSON();
    
    const updatedBatch = new Batch({
      ...existingBatch,
      ...data,
      updated_at: moment().toISOString(),
      updated_by: user.id
    });
    
    const result = await this.batchRepository.update(updatedBatch);
    
    const chemical = await this.chemicalRepository.findById(result.chemical_id);
    
    await this.auditLogRepository.logAction({
      action: AuditLog.actions.BATCH_UPDATE,
      entity_type: AuditLog.entityTypes.BATCH,
      entity_id: id,
      entity_name: `${chemical?.name || '未知'} - ${result.batch_number}`,
      description: `更新批次: ${result.batch_number}`,
      old_value: oldValue,
      new_value: result.toJSON(),
      user_id: user.id,
      user_role: user.role
    });
    
    return result;
  }

  async getBatchById(id, user) {
    const batch = await this.batchRepository.findById(id);
    if (!batch) {
      const error = new Error(`批次不存在: ${id}`);
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }
    
    const chemical = await this.chemicalRepository.findById(batch.chemical_id);
    const batchJson = batch.toJSON();
    batchJson.chemical = chemical?.toJSON() || null;
    
    return batchJson;
  }

  async getBatches(options = {}, user) {
    const batches = await this.batchRepository.findAll(options);
    const total = await this.batchRepository.count(options);
    
    const chemicalsMap = new Map();
    for (const batch of batches) {
      if (!chemicalsMap.has(batch.chemical_id)) {
        const chemical = await this.chemicalRepository.findById(batch.chemical_id);
        chemicalsMap.set(batch.chemical_id, chemical);
      }
    }
    
    const batchesWithChemical = batches.map(batch => {
      const batchJson = batch.toJSON();
      batchJson.chemical = chemicalsMap.get(batch.chemical_id)?.toJSON() || null;
      return batchJson;
    });
    
    return {
      data: batchesWithChemical,
      pagination: {
        total,
        limit: options.limit || 100,
        offset: options.offset || 0
      }
    };
  }

  async getBatchesByChemicalId(chemicalId, user) {
    const chemical = await this.chemicalRepository.findById(chemicalId);
    if (!chemical) {
      const error = new Error(`试剂不存在: ${chemicalId}`);
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }
    
    const batches = await this.batchRepository.findByChemicalId(chemicalId);
    
    return {
      data: batches.map(batch => {
        const batchJson = batch.toJSON();
        batchJson.chemical = chemical.toJSON();
        return batchJson;
      })
    };
  }

  async getExpiringBatches(user) {
    PermissionValidator.checkIsSafetyOfficer(user.role);
    
    const batches = await this.batchRepository.getExpiringBatches(config.alert.expiry_days_threshold);
    
    const chemicalsMap = new Map();
    for (const batch of batches) {
      if (!chemicalsMap.has(batch.chemical_id)) {
        const chemical = await this.chemicalRepository.findById(batch.chemical_id);
        chemicalsMap.set(batch.chemical_id, chemical);
      }
    }
    
    return {
      data: batches.map(batch => {
        const batchJson = batch.toJSON();
        batchJson.chemical = chemicalsMap.get(batch.chemical_id)?.toJSON() || null;
        return batchJson;
      }),
      threshold_days: config.alert.expiry_days_threshold
    };
  }

  async getLowStockBatches(user) {
    PermissionValidator.checkIsSafetyOfficer(user.role);
    
    const batches = await this.batchRepository.getLowStockBatches(config.alert.stock_threshold);
    
    const chemicalsMap = new Map();
    for (const batch of batches) {
      if (!chemicalsMap.has(batch.chemical_id)) {
        const chemical = await this.chemicalRepository.findById(batch.chemical_id);
        chemicalsMap.set(batch.chemical_id, chemical);
      }
    }
    
    return {
      data: batches.map(batch => {
        const batchJson = batch.toJSON();
        batchJson.chemical = chemicalsMap.get(batch.chemical_id)?.toJSON() || null;
        return batchJson;
      }),
      threshold: config.alert.stock_threshold
    };
  }
}

module.exports = BatchService;
