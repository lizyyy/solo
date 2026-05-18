const noFlyRepository = require('../repositories/NoFlyRepository');
const referenceRepository = require('../repositories/ReferenceRepository');
const {
  validateNoFlyRecord,
  validateStatusChange,
  validateTimeOverlap,
  validateImportRow,
  STATUS_APPROVED,
  STATUS_RESTORED
} = require('../models/NoFlyRecord');
const { v4: uuidv4 } = require('uuid');

class NoFlyService {
  async createRecord(data) {
    const validation = validateNoFlyRecord(data);
    if (!validation.isValid) {
      return { success: false, errors: validation.errors };
    }

    const route = await referenceRepository.getRouteById(data.route_id);
    if (!route) {
      return { success: false, errors: ['指定的航线不存在'] };
    }

    const applicant = await referenceRepository.getApplicantById(data.applicant_id);
    if (!applicant) {
      return { success: false, errors: ['指定的申请人不存在'] };
    }

    const activeRecords = await noFlyRepository.getActiveRecords(data.route_id);
    const conflicts = validateTimeOverlap(activeRecords, data);
    
    if (conflicts.length > 0) {
      return {
        success: false,
        errors: ['存在时间冲突的禁飞记录'],
        conflicts
      };
    }

    const result = await noFlyRepository.createRecord(validation.value);
    return { success: true, data: result };
  }

  async changeStatus(id, newStatus, operator, remark = '') {
    const record = await noFlyRepository.getById(id);
    if (!record) {
      return { success: false, errors: ['记录不存在'] };
    }

    const validation = validateStatusChange(record.status, newStatus, {
      status: newStatus,
      operator,
      remark
    });

    if (!validation.isValid) {
      return { success: false, errors: validation.errors };
    }

    await noFlyRepository.updateRecordStatus(id, newStatus);
    await noFlyRepository.addHistory(id, record.status, newStatus, operator, remark);

    const updatedRecord = await noFlyRepository.getById(id);

    if (newStatus === STATUS_APPROVED && record.cancel_older_tasks === 1) {
      console.log(`禁飞已生效，航线 ${record.route_id} 的旧任务需要被取消`);
    }

    return { success: true, data: updatedRecord };
  }

  async getRecordById(id) {
    const record = await noFlyRepository.getById(id);
    if (!record) {
      return { success: false, errors: ['记录不存在'] };
    }

    const history = await noFlyRepository.getHistory(id);
    return { success: true, data: { ...record, history } };
  }

  async getRecords(filters = {}) {
    const records = await noFlyRepository.getAll(filters);
    return { success: true, data: records };
  }

  async getHistory(id) {
    const history = await noFlyRepository.getHistory(id);
    return { success: true, data: history };
  }

  async validateAndImport(rows, batchId = null) {
    const actualBatchId = batchId || uuidv4();
    const [routes, drones, applicants] = await Promise.all([
      referenceRepository.getAllRoutes(),
      referenceRepository.getAllDrones(),
      referenceRepository.getAllApplicants()
    ]);

    const referenceData = { routes, drones, applicants };
    const validationResults = [];
    const validRecords = [];

    for (let i = 0; i < rows.length; i++) {
      const result = validateImportRow(rows[i], i + 1, referenceData);
      validationResults.push(result);

      if (result.isValid) {
        const route = routes.find(r => r.code === rows[i].route_code);
        const drone = rows[i].drone_code ? drones.find(d => d.code === rows[i].drone_code) : null;
        const applicant = applicants.find(a => a.name === rows[i].applicant_name);

        validRecords.push({
          route_id: route.id,
          drone_id: drone ? drone.id : null,
          start_time: rows[i].start_time,
          end_time: rows[i].end_time,
          applicant_id: applicant.id,
          reason: rows[i].reason,
          cancel_older_tasks: rows[i].cancel_older_tasks !== 'false'
        });
      }
    }

    await noFlyRepository.saveImportValidation(actualBatchId, validationResults);

    const createdRecords = [];
    for (const record of validRecords) {
      const result = await this.createRecord(record);
      if (result.success) {
        createdRecords.push(result.data);
      } else {
        const idx = validRecords.indexOf(record);
        validationResults[idx].isValid = false;
        validationResults[idx].errors = [...validationResults[idx].errors, ...result.errors];
        if (result.conflicts) {
          validationResults[idx].conflicts = result.conflicts;
        }
      }
    }

    return {
      success: true,
      batchId: actualBatchId,
      total: rows.length,
      valid: createdRecords.length,
      invalid: rows.length - createdRecords.length,
      validationResults,
      createdRecords
    };
  }

  async getImportValidation(batchId) {
    const results = await noFlyRepository.getImportValidation(batchId);
    return { success: true, data: results };
  }

  async exportRecords(filters = {}) {
    const { data: records } = await this.getRecords(filters);
    
    return records.map(r => ({
      禁飞记录ID: r.id,
      航线名称: r.route_name,
      航线代码: r.route_code,
      无人机名称: r.drone_name || '',
      无人机代码: r.drone_code || '',
      申请人: r.applicant_name,
      部门: r.applicant_department,
      开始时间: r.start_time,
      结束时间: r.end_time,
      禁飞原因: r.reason,
      状态: r.status,
      是否取消旧任务: r.cancel_older_tasks === 1 ? '是' : '否',
      创建时间: r.created_at,
      更新时间: r.updated_at
    }));
  }
}

module.exports = new NoFlyService();