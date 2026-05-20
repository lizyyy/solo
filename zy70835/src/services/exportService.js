const CheckRecordModel = require('../models/checkRecordModel');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');

class ExportService {
  static ensureExportDir() {
    const exportDir = path.join(__dirname, '../../exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    return exportDir;
  }

  static async exportToCSV(check_date) {
    const records = await CheckRecordModel.exportByDate(check_date);
    const statistics = await CheckRecordModel.getStatistics(check_date);

    if (records.length === 0) {
      throw new Error('该日期没有数据可导出');
    }

    const exportDir = this.ensureExportDir();
    const filePath = path.join(exportDir, `晨检异常追踪_${check_date}.csv`);

    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'batch_no', title: '批次编号' },
        { id: 'check_date', title: '晨检日期' },
        { id: 'class_name', title: '班级' },
        { id: 'student_id', title: '学号' },
        { id: 'student_name', title: '学生姓名' },
        { id: 'temperature', title: '体温' },
        { id: 'has_medication_text', title: '是否带药' },
        { id: 'medication_details', title: '用药嘱托' },
        { id: 'parent_confirmed_text', title: '家长确认' },
        { id: 'parent_name', title: '家长姓名' },
        { id: 'parent_phone', title: '家长电话' },
        { id: 'status_text', title: '处理状态' },
        { id: 'abnormal_type_text', title: '异常类型' },
        { id: 'follow_up_status_text', title: '回访状态' },
        { id: 'follow_up_remark', title: '回访备注' },
        { id: 'handler', title: '处理人' },
        { id: 'last_handler', title: '最后处理人' },
        { id: 'created_at', title: '创建时间' },
        { id: 'updated_at', title: '更新时间' }
      ]
    });

    const data = records.map(record => ({
      ...record,
      has_medication_text: record.has_medication ? '是' : '否',
      parent_confirmed_text: record.parent_confirmed ? '已确认' : '未确认',
      status_text: this.getStatusText(record.status),
      abnormal_type_text: this.getAbnormalTypeText(record.abnormal_type),
      follow_up_status_text: this.getFollowUpStatusText(record.follow_up_status)
    }));

    await csvWriter.writeRecords(data);

    return {
      filePath,
      fileName: `晨检异常追踪_${check_date}.csv`,
      statistics: {
        total: statistics.total || 0,
        normal: statistics.normal || 0,
        pending: statistics.pending || 0,
        blocked: statistics.blocked || 0,
        fever_quarantine: statistics.fever_quarantine || 0,
        medication_auth: statistics.medication_auth || 0,
        parent_unconfirmed: statistics.parent_unconfirmed || 0
      },
      recordCount: records.length
    };
  }

  static getStatusText(status) {
    const map = {
      normal: '正常',
      pending: '待补充',
      blocked: '已拦截'
    };
    return map[status] || status;
  }

  static getAbnormalTypeText(type) {
    const map = {
      fever_quarantine: '发热隔离',
      medication_auth: '用药授权',
      parent_unconfirmed: '家长未确认'
    };
    return map[type] || type || '无异常';
  }

  static getFollowUpStatusText(status) {
    const map = {
      pending: '待回访',
      completed: '已完成',
      no_need: '无需回访'
    };
    return map[status] || status;
  }

  static async getStatistics(check_date) {
    const statistics = await CheckRecordModel.getStatistics(check_date);
    
    return {
      check_date,
      total: statistics.total || 0,
      normal: statistics.normal || 0,
      pending: statistics.pending || 0,
      blocked: statistics.blocked || 0,
      abnormal_breakdown: {
        fever_quarantine: {
          count: statistics.fever_quarantine || 0,
          description: '发热隔离 - 体温超过正常值，需要隔离观察'
        },
        medication_auth: {
          count: statistics.medication_auth || 0,
          description: '用药授权 - 需要家长授权用药'
        },
        parent_unconfirmed: {
          count: statistics.parent_unconfirmed || 0,
          description: '家长未确认 - 家长未确认晨检相关信息'
        }
      }
    };
  }
}

module.exports = ExportService;