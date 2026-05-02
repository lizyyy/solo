const moment = require('moment');
const Chemical = require('../models/Chemical');
const { ChemicalRepository, AuditLogRepository } = require('../storage/repositories');
const { PermissionValidator, PermissionError } = require('../validation/PermissionValidator');
const { DangerLevelValidator, DangerLevelError } = require('../validation/DangerLevelValidator');
const { RequestDuplicateValidator } = require('../validation/DuplicateSubmitValidator');
const AuditLog = require('../models/AuditLog');

class ChemicalService {
  constructor() {
    this.chemicalRepository = new ChemicalRepository();
    this.auditLogRepository = new AuditLogRepository();
  }

  async createChemical(data, user) {
    PermissionValidator.checkPermission(user.role, 'create_chemical');
    
    const validationErrors = Chemical.validate(data);
    if (validationErrors.length > 0) {
      const error = new Error(validationErrors[0]);
      error.status = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    
    DangerLevelValidator.validate(data.danger_level);
    
    await RequestDuplicateValidator.checkDuplicateChemicalName(
      this.chemicalRepository,
      data.name
    );
    
    if (data.cas_number) {
      await RequestDuplicateValidator.checkDuplicateCasNumber(
        this.chemicalRepository,
        data.cas_number
      );
    }
    
    const chemical = new Chemical({
      ...data,
      created_by: user.id,
      updated_by: user.id
    });
    
    const createdChemical = await this.chemicalRepository.create(chemical);
    
    await this.auditLogRepository.logAction({
      action: AuditLog.actions.CHEMICAL_CREATE,
      entity_type: AuditLog.entityTypes.CHEMICAL,
      entity_id: createdChemical.id,
      entity_name: createdChemical.name,
      description: `创建试剂: ${createdChemical.name}`,
      new_value: createdChemical.toJSON(),
      user_id: user.id,
      user_role: user.role
    });
    
    return createdChemical;
  }

  async updateChemical(id, data, user) {
    PermissionValidator.checkPermission(user.role, 'update_chemical');
    
    const existingChemical = await this.chemicalRepository.findById(id);
    if (!existingChemical) {
      const error = new Error(`试剂不存在: ${id}`);
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }
    
    if (data.danger_level) {
      DangerLevelValidator.validate(data.danger_level);
    }
    
    if (data.name && data.name !== existingChemical.name) {
      await RequestDuplicateValidator.checkDuplicateChemicalName(
        this.chemicalRepository,
        data.name,
        id
      );
    }
    
    if (data.cas_number && data.cas_number !== existingChemical.cas_number) {
      await RequestDuplicateValidator.checkDuplicateCasNumber(
        this.chemicalRepository,
        data.cas_number,
        id
      );
    }
    
    const oldValue = existingChemical.toJSON();
    
    const updatedChemical = new Chemical({
      ...existingChemical,
      ...data,
      updated_at: moment().toISOString(),
      updated_by: user.id
    });
    
    const result = await this.chemicalRepository.update(updatedChemical);
    
    await this.auditLogRepository.logAction({
      action: AuditLog.actions.CHEMICAL_UPDATE,
      entity_type: AuditLog.entityTypes.CHEMICAL,
      entity_id: id,
      entity_name: updatedChemical.name,
      description: `更新试剂: ${updatedChemical.name}`,
      old_value: oldValue,
      new_value: result.toJSON(),
      user_id: user.id,
      user_role: user.role
    });
    
    return result;
  }

  async deleteChemical(id, user) {
    PermissionValidator.checkIsAdmin(user.role);
    
    const existingChemical = await this.chemicalRepository.findById(id);
    if (!existingChemical) {
      const error = new Error(`试剂不存在: ${id}`);
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }
    
    const oldValue = existingChemical.toJSON();
    
    const deleted = await this.chemicalRepository.delete(id);
    if (!deleted) {
      const error = new Error('删除失败');
      error.status = 500;
      error.code = 'DELETE_FAILED';
      throw error;
    }
    
    await this.auditLogRepository.logAction({
      action: AuditLog.actions.CHEMICAL_DELETE,
      entity_type: AuditLog.entityTypes.CHEMICAL,
      entity_id: id,
      entity_name: existingChemical.name,
      description: `删除试剂: ${existingChemical.name}`,
      old_value: oldValue,
      user_id: user.id,
      user_role: user.role
    });
    
    return true;
  }

  async getChemicalById(id, user) {
    const chemical = await this.chemicalRepository.findById(id);
    if (!chemical) {
      const error = new Error(`试剂不存在: ${id}`);
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }
    return chemical;
  }

  async getChemicals(options = {}, user) {
    const chemicals = await this.chemicalRepository.findAll(options);
    const total = await this.chemicalRepository.count(options);
    
    return {
      data: chemicals,
      pagination: {
        total,
        limit: options.limit || 100,
        offset: options.offset || 0
      }
    };
  }

  async getDangerLevels() {
    return DangerLevelValidator.getAllDangerLevels();
  }
}

module.exports = ChemicalService;
