const CheckRecordModel = require('../models/checkRecordModel');
const BatchModel = require('../models/batchModel');

const STATUS_TYPES = {
  NORMAL: 'normal',
  PENDING: 'pending',
  BLOCKED: 'blocked'
};

const ABNORMAL_TYPES = {
  FEVER_QUARANTINE: 'fever_quarantine',
  MEDICATION_AUTH: 'medication_auth',
  PARENT_UNCONFIRMED: 'parent_unconfirmed'
};

const STATUS_DESCRIPTIONS = {
  normal: '正常 - 晨检通过，无异常情况',
  pending: '待补充 - 信息不完整，需要补充材料后重新审核',
  blocked: '已拦截 - 存在异常情况，需要进一步处理或隔离'
};

const ABNORMAL_DESCRIPTIONS = {
  fever_quarantine: '发热隔离 - 体温超过正常值，需要隔离观察',
  medication_auth: '用药授权 - 需要家长授权用药',
  parent_unconfirmed: '家长未确认 - 家长未确认晨检相关信息'
};

class CheckService {
  static classifyRecord(recordData) {
    const { temperature, has_medication, parent_confirmed } = recordData;
    let status = STATUS_TYPES.NORMAL;
    let abnormal_type = null;

    if (temperature >= 37.5) {
      status = STATUS_TYPES.BLOCKED;
      abnormal_type = ABNORMAL_TYPES.FEVER_QUARANTINE;
    } else if (has_medication && !parent_confirmed) {
      status = STATUS_TYPES.PENDING;
      abnormal_type = ABNORMAL_TYPES.PARENT_UNCONFIRMED;
    } else if (!parent_confirmed) {
      status = STATUS_TYPES.PENDING;
      abnormal_type = ABNORMAL_TYPES.PARENT_UNCONFIRMED;
    } else if (has_medication && parent_confirmed) {
      status = STATUS_TYPES.PENDING;
      abnormal_type = ABNORMAL_TYPES.MEDICATION_AUTH;
    }

    return {
      status,
      abnormal_type,
      status_description: STATUS_DESCRIPTIONS[status],
      abnormal_description: abnormal_type ? ABNORMAL_DESCRIPTIONS[abnormal_type] : null
    };
  }

  static async createRecord(recordData) {
    const classification = this.classifyRecord(recordData);
    
    const record = await CheckRecordModel.create({
      ...recordData,
      status: classification.status,
      abnormal_type: classification.abnormal_type
    });

    await BatchModel.updateCounts(recordData.batch_id);

    return {
      ...record,
      ...classification
    };
  }

  static async triggerReview(record_id, operator, review_reason) {
    const record = await CheckRecordModel.findById(record_id);
    if (!record) {
      throw new Error('记录不存在');
    }

    await CheckRecordModel.updateStatus(
      record_id,
      STATUS_TYPES.PENDING,
      record.abnormal_type,
      operator,
      `触发复核: ${review_reason}`
    );

    await BatchModel.updateCounts(record.batch_id);

    return this.getRecordDetail(record_id);
  }

  static async updateRecordStatus(record_id, new_status, new_abnormal_type, operator, reason) {
    const record = await CheckRecordModel.findById(record_id);
    if (!record) {
      throw new Error('记录不存在');
    }

    await CheckRecordModel.updateStatus(
      record_id,
      new_status,
      new_abnormal_type,
      operator,
      reason
    );

    await BatchModel.updateCounts(record.batch_id);

    return this.getRecordDetail(record_id);
  }

  static async getRecordDetail(record_id) {
    const record = await CheckRecordModel.findById(record_id);
    if (!record) {
      return null;
    }

    const trails = await CheckRecordModel.getTrails(record_id);
    const changeHistory = await CheckRecordModel.getChangeHistory(record_id);

    return {
      ...record,
      status_description: STATUS_DESCRIPTIONS[record.status] || null,
      abnormal_description: record.abnormal_type ? ABNORMAL_DESCRIPTIONS[record.abnormal_type] : null,
      trails: trails.map(trail => ({
        ...trail,
        old_status_description: trail.old_status ? STATUS_DESCRIPTIONS[trail.old_status] : null,
        new_status_description: trail.new_status ? STATUS_DESCRIPTIONS[trail.new_status] : null
      })),
      change_history: changeHistory
    };
  }

  static async updateFollowUp(record_id, follow_up_status, follow_up_remark, operator) {
    const record = await CheckRecordModel.findById(record_id);
    if (!record) {
      throw new Error('记录不存在');
    }

    await CheckRecordModel.updateFollowUp(record_id, follow_up_status, follow_up_remark, operator);

    return this.getRecordDetail(record_id);
  }

  static async getClassRecords(class_name) {
    const records = await CheckRecordModel.findByClass(class_name);
    
    return records.map(record => ({
      ...record,
      status_description: STATUS_DESCRIPTIONS[record.status] || null,
      abnormal_description: record.abnormal_type ? ABNORMAL_DESCRIPTIONS[record.abnormal_type] : null
    }));
  }

  static getStatusTypes() {
    return STATUS_TYPES;
  }

  static getAbnormalTypes() {
    return ABNORMAL_TYPES;
  }

  static getStatusDescriptions() {
    return STATUS_DESCRIPTIONS;
  }

  static getAbnormalDescriptions() {
    return ABNORMAL_DESCRIPTIONS;
  }
}

module.exports = CheckService;