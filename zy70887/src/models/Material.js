const db = require('../database');
const Joi = require('joi');

const materialSchema = Joi.object({
  contract_no: Joi.string().allow(null, ''),
  contract_name: Joi.string().allow(null, ''),
  party_a: Joi.string().allow(null, ''),
  party_b: Joi.string().allow(null, ''),
  sign_date: Joi.date().iso().allow(null, ''),
  amount: Joi.number().precision(2).allow(null),
  page_count: Joi.number().integer().allow(null),
  is_authorized: Joi.boolean().default(false)
});

class Material {
  static validate(material, index, existingContractNos = []) {
    const errors = [];
    
    if (!material.contract_name) {
      errors.push({
        material_index: index,
        field: 'contract_name',
        message: '合同名称为必填项',
        type: 'missing_field'
      });
    }
    
    const { error, value } = materialSchema.validate(material, { abortEarly: false });
    
    if (error) {
      error.details.forEach(detail => {
        errors.push({
          material_index: index,
          field: detail.path[0],
          message: detail.message,
          type: 'missing_field'
        });
      });
    }
    
    if (material.sign_date) {
      const signDate = new Date(material.sign_date);
      const today = new Date();
      if (signDate > today) {
        errors.push({
          material_index: index,
          field: 'sign_date',
          message: '签署日期不能晚于当前日期',
          type: 'date_conflict'
        });
      }
    }
    
    if (material.contract_no && existingContractNos.includes(material.contract_no)) {
      errors.push({
        material_index: index,
        field: 'contract_no',
        message: `合同编号 ${material.contract_no} 重复`,
        type: 'duplicate_number'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      value
    };
  }

  static async bulkCreate(taskId, materials) {
    const results = [];
    const existingContractNos = [];
    
    for (let i = 0; i < materials.length; i++) {
      const material = materials[i];
      const validation = this.validate(material, i, existingContractNos);
      
      if (material.contract_no) {
        existingContractNos.push(material.contract_no);
      }
      
      const result = await db.run(
        `INSERT INTO materials (task_id, material_index, contract_no, contract_name, party_a, 
         party_b, sign_date, amount, page_count, is_authorized, raw_data, validation_errors, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          taskId,
          i,
          material.contract_no || null,
          material.contract_name,
          material.party_a || null,
          material.party_b || null,
          material.sign_date || null,
          material.amount || null,
          material.page_count || null,
          material.is_authorized ? 1 : 0,
          JSON.stringify(material),
          JSON.stringify(validation.errors),
          validation.isValid ? 'valid' : 'invalid'
        ]
      );
      
      results.push({
        id: result.lastID,
        material_index: i,
        validation
      });
    }
    
    return results;
  }

  static async getByTaskId(taskId) {
    return await db.all(
      'SELECT * FROM materials WHERE task_id = ? ORDER BY material_index',
      [taskId]
    );
  }

  static async getById(id) {
    return await db.get('SELECT * FROM materials WHERE id = ?', [id]);
  }

  static async updateStatus(id, status) {
    await db.run(
      'UPDATE materials SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );
    return await this.getById(id);
  }

  static async update(id, updates, operatorId, reason) {
    const oldMaterial = await this.getById(id);
    
    const fields = [];
    const params = [];
    
    const allowedFields = ['contract_no', 'contract_name', 'party_a', 'party_b', 'sign_date', 'amount', 'page_count', 'is_authorized', 'status'];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        fields.push(`${field} = ?`);
        params.push(updates[field]);
      }
    }
    
    if (fields.length === 0) return oldMaterial;
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    
    await db.run(
      `UPDATE materials SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
    
    const AuditLog = require('./AuditLog');
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined && oldMaterial[field] !== updates[field]) {
        await AuditLog.create({
          taskId: oldMaterial.task_id,
          materialId: id,
          operatorId,
          action: 'update_material',
          fieldName: field,
          oldValue: String(oldMaterial[field]),
          newValue: String(updates[field]),
          reason
        });
      }
    }
    
    return await this.getById(id);
  }

  static async getValidationSummary(taskId) {
    const materials = await this.getByTaskId(taskId);
    
    const summary = {
      total: materials.length,
      valid: 0,
      invalid: 0,
      errors: []
    };
    
    materials.forEach(m => {
      if (m.status === 'valid') {
        summary.valid++;
      } else {
        summary.invalid++;
        const errors = JSON.parse(m.validation_errors || '[]');
        summary.errors.push(...errors);
      }
    });
    
    return summary;
  }
}

module.exports = Material;
