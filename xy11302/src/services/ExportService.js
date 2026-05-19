const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const CleaningRecord = require('../models/CleaningRecord');
const Complaint = require('../models/Complaint');
const Rework = require('../models/Rework');
const Settlement = require('../models/Settlement');

class ExportService {
  static async exportCleaningRecords(filters = {}) {
    const records = await CleaningRecord.findAll(filters);
    
    const fields = [
      { label: 'ID', value: 'id' },
      { label: '房间号', value: 'room_number' },
      { label: '保洁员', value: 'cleaner_name' },
      { label: '保洁日期', value: 'check_date' },
      { label: '保洁时间', value: 'check_time' },
      { label: '状态', value: 'status' },
      { label: '质量分数', value: 'quality_score' },
      { label: '是否有问题', value: (row) => row.has_issue ? '是' : '否' },
      { label: '问题描述', value: 'issue_description' },
      { label: '复核人', value: 'reviewer_name' },
      { label: '复核时间', value: 'reviewed_at' },
      { label: '创建时间', value: 'created_at' }
    ];

    return this.generateCSV(records, fields, 'cleaning_records');
  }

  static async exportComplaints(filters = {}) {
    const records = await Complaint.findAll(filters);
    
    const fields = [
      { label: 'ID', value: 'id' },
      { label: '房间号', value: 'room_number' },
      { label: '投诉类型', value: 'complaint_type' },
      { label: '投诉描述', value: 'description' },
      { label: '投诉人', value: 'reporter_name' },
      { label: '处理人', value: 'handler_name' },
      { label: '状态', value: 'status' },
      { label: '处理结果', value: 'handling_result' },
      { label: '扣款金额', value: 'deduction_amount' },
      { label: '发生时间', value: 'occurred_at' },
      { label: '处理时间', value: 'handled_at' },
      { label: '创建时间', value: 'created_at' }
    ];

    return this.generateCSV(records, fields, 'complaints');
  }

  static async exportReworks(filters = {}) {
    const records = await Rework.findAll(filters);
    
    const fields = [
      { label: 'ID', value: 'id' },
      { label: '房间号', value: 'room_number' },
      { label: '原保洁员', value: 'original_cleaner' },
      { label: '返工人员', value: 'reworker_name' },
      { label: '返工原因', value: 'reason' },
      { label: '状态', value: 'status' },
      { label: '返工日期', value: 'rework_date' },
      { label: '复核人', value: 'reviewer_name' },
      { label: '扣款金额', value: 'deduction_amount' },
      { label: '创建时间', value: 'created_at' }
    ];

    return this.generateCSV(records, fields, 'reworks');
  }

  static async exportSettlements(filters = {}) {
    const records = await Settlement.findAll(filters);
    
    const fields = [
      { label: 'ID', value: 'id' },
      { label: '结算月份', value: 'settlement_month' },
      { label: '保洁员', value: 'cleaner_name' },
      { label: '保洁次数', value: 'total_cleanings' },
      { label: '返工次数', value: 'total_reworks' },
      { label: '投诉次数', value: 'total_complaints' },
      { label: '总扣款', value: 'total_deduction' },
      { label: '最终金额', value: 'final_amount' },
      { label: '状态', value: 'status' },
      { label: '复核人', value: 'reviewed_by' },
      { label: '创建时间', value: 'created_at' }
    ];

    return this.generateCSV(records, fields, 'settlements');
  }

  static async exportAllByMonth(month, cleanerName = null) {
    const filters = { start_date: `${month}-01`, end_date: `${month}-31` };
    if (cleanerName) filters.cleaner_name = cleanerName;

    const cleaningRecords = await CleaningRecord.findAll(filters);
    const complaints = await Complaint.findAll({ ...filters, handler_name: cleanerName });
    const reworks = await Rework.findAll({ ...filters, original_cleaner: cleanerName });
    const settlements = await Settlement.findAll({ settlement_month: month, cleaner_name: cleanerName });

    const timestamp = new Date().getTime();
    const fileName = `monthly_report_${month}_${timestamp}.xlsx`;
    const filePath = path.join(__dirname, '../../exports', fileName);

    const reportData = {
      month,
      cleanerName,
      summary: {
        totalCleanings: cleaningRecords.length,
        approvedCleanings: cleaningRecords.filter(r => r.status === 'approved').length,
        pendingReview: cleaningRecords.filter(r => r.status === 'pending').length,
        hasIssues: cleaningRecords.filter(r => r.has_issue).length,
        totalComplaints: complaints.length,
        totalReworks: reworks.length,
        totalDeduction: (complaints.reduce((sum, c) => sum + (c.deduction_amount || 0), 0) +
                        reworks.reduce((sum, r) => sum + (r.deduction_amount || 0), 0))
      },
      cleaningRecords,
      complaints,
      reworks,
      settlements
    };

    const jsonContent = JSON.stringify(reportData, null, 2);
    const jsonFilePath = filePath.replace('.xlsx', '.json');
    fs.writeFileSync(jsonFilePath, jsonContent, 'utf8');

    const csvPath = await this.exportCleaningRecords(filters);
    
    return {
      jsonFile: path.basename(jsonFilePath),
      csvFile: path.basename(csvPath),
      summary: reportData.summary
    };
  }

  static generateCSV(data, fields, type) {
    return new Promise((resolve, reject) => {
      try {
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(data);

        const timestamp = new Date().getTime();
        const fileName = `${type}_${timestamp}.csv`;
        const filePath = path.join(__dirname, '../../exports', fileName);

        fs.writeFileSync(filePath, csv, 'utf8');
        resolve(filePath);
      } catch (error) {
        reject(error);
      }
    });
  }

  static getExportFilePath(fileName) {
    return path.join(__dirname, '../../exports', fileName);
  }
}

module.exports = ExportService;