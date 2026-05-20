const BatchModel = require('../models/batchModel');
const CheckRecordModel = require('../models/checkRecordModel');
const moment = require('moment');

class BatchService {
  static generateBatchNo(check_date) {
    const dateStr = moment(check_date).format('YYYYMMDD');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `MC-${dateStr}-${random}`;
  }

  static async createBatch(batchData) {
    const { check_date, created_by } = batchData;
    
    const existingBatch = await BatchModel.findByNo(this.generateBatchNo(check_date));
    if (existingBatch) {
      throw new Error('该日期的批次已存在');
    }

    const batch_no = this.generateBatchNo(check_date);
    
    const batch = await BatchModel.create({
      batch_no,
      check_date,
      created_by
    });

    return batch;
  }

  static async getBatchById(id) {
    const batch = await BatchModel.findById(id);
    if (!batch) {
      return null;
    }

    const records = await CheckRecordModel.findByBatch(id);
    
    return {
      ...batch,
      records: records.map(record => ({
        id: record.id,
        student_id: record.student_id,
        student_name: record.student_name,
        class_name: record.class_name,
        status: record.status,
        abnormal_type: record.abnormal_type,
        temperature: record.temperature,
        has_medication: record.has_medication,
        parent_confirmed: record.parent_confirmed,
        follow_up_status: record.follow_up_status
      }))
    };
  }

  static async getBatchByNo(batch_no) {
    const batch = await BatchModel.findByNo(batch_no);
    if (!batch) {
      return null;
    }

    return this.getBatchById(batch.id);
  }

  static async listBatches(page = 1, pageSize = 20) {
    const batches = await BatchModel.list(page, pageSize);
    return batches;
  }

  static async addRecordToBatch(batch_id, recordData) {
    const batch = await BatchModel.findById(batch_id);
    if (!batch) {
      throw new Error('批次不存在');
    }

    return { batch_id, ...recordData };
  }
}

module.exports = BatchService;