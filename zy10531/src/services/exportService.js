const db = require('../models/database');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

class ExportService {
  async generateReport(vendorCode, validationId, reportType = 'json') {
    const reportId = uuidv4();

    const vendor = await new Promise((resolve, reject) => {
      db.get(`SELECT * FROM vendors WHERE vendor_code = ?`, [vendorCode], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    const validation = await new Promise((resolve, reject) => {
      db.get(`SELECT * FROM validation_records WHERE validation_id = ?`, [validationId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    const missingItems = await new Promise((resolve, reject) => {
      db.all(`SELECT * FROM missing_items WHERE validation_id = ?`, [validationId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const corrections = await new Promise((resolve, reject) => {
      db.all(`SELECT * FROM correction_records WHERE vendor_code = ?`, [vendorCode], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const reportContent = {
      reportId,
      generatedAt: new Date().toISOString(),
      vendor: {
        vendorCode: vendor.vendor_code,
        vendorName: vendor.vendor_name,
        status: vendor.status
      },
      validation: {
        validationId: validation.validation_id,
        status: validation.status,
        validatedAt: validation.created_at
      },
      missingItems,
      corrections,
      summary: {
        totalMissing: missingItems.length,
        resolvedMissing: missingItems.filter(m => m.resolved).length,
        totalCorrections: corrections.length
      }
    };

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO validation_reports (report_id, vendor_code, validation_id, report_type, report_content)
         VALUES (?, ?, ?, ?, ?)`,
        [reportId, vendorCode, validationId, reportType, JSON.stringify(reportContent)],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    return { reportId, reportContent };
  }

  async exportToExcel(vendorCode, validationId) {
    const { reportId, reportContent } = await this.generateReport(vendorCode, validationId, 'excel');

    const wb = XLSX.utils.book_new();

    const vendorSheet = XLSX.utils.json_to_sheet([
      {
        '供应商编号': reportContent.vendor.vendorCode,
        '供应商名称': reportContent.vendor.vendorName,
        '状态': reportContent.vendor.status
      }
    ]);
    XLSX.utils.book_append_sheet(wb, vendorSheet, '供应商信息');

    const missingSheet = XLSX.utils.json_to_sheet(
      reportContent.missingItems.map(item => ({
        '字段名称': item.field_label,
        '错误类型': item.error_type,
        '错误信息': item.error_message,
        '是否已解决': item.resolved ? '是' : '否',
        '创建时间': item.created_at
      }))
    );
    XLSX.utils.book_append_sheet(wb, missingSheet, '缺失项明细');

    const correctionSheet = XLSX.utils.json_to_sheet(
      reportContent.corrections.map(item => ({
        '字段名称': item.field_name,
        '原值': item.old_value,
        '新值': item.new_value,
        '修正人': item.corrected_by,
        '修正备注': item.correction_note,
        '修正时间': item.created_at
      }))
    );
    XLSX.utils.book_append_sheet(wb, correctionSheet, '修正记录');

    const summarySheet = XLSX.utils.json_to_sheet([
      {
        '总缺失项数': reportContent.summary.totalMissing,
        '已解决缺失项数': reportContent.summary.resolvedMissing,
        '总修正记录数': reportContent.summary.totalCorrections,
        '报告生成时间': reportContent.generatedAt
      }
    ]);
    XLSX.utils.book_append_sheet(wb, summarySheet, '汇总信息');

    const filePath = path.join(__dirname, `../../data/report_${reportId}.xlsx`);
    XLSX.writeFile(wb, filePath);

    return { reportId, filePath, reportContent };
  }

  async getReport(reportId) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM validation_reports WHERE report_id = ?`, [reportId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getAllReports(vendorCode = null) {
    let query = `SELECT * FROM validation_reports`;
    let values = [];

    if (vendorCode) {
      query += ` WHERE vendor_code = ?`;
      values.push(vendorCode);
    }

    query += ` ORDER BY created_at DESC`;

    return new Promise((resolve, reject) => {
      db.all(query, values, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = new ExportService();
