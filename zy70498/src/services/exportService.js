const db = require('../database/db');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');

class ExportService {
  async exportRecordsToCSV(filters = {}) {
    let sql = `
      SELECT 
        sr.id,
        sr.batch_id,
        sr.supplier_name,
        sr.supplier_dir_before,
        sr.supplier_dir_after,
        sr.total_score,
        sr.risk_level,
        sr.status,
        sr.zip_path,
        sr.error_message,
        sr.material_summary,
        sr.conclusion,
        sr.created_at
      FROM scoring_records sr
      WHERE 1=1
    `;
    const params = [];

    if (filters.risk_level) {
      sql += ' AND sr.risk_level = ?';
      params.push(filters.risk_level);
    }

    if (filters.status) {
      sql += ' AND sr.status = ?';
      params.push(filters.status);
    }

    if (filters.supplier_name) {
      sql += ' AND sr.supplier_name LIKE ?';
      params.push(`%${filters.supplier_name}%`);
    }

    sql += ' ORDER BY sr.created_at DESC';

    const records = await db.all(sql, params);

    for (const record of records) {
      const scoreItems = await db.all(
        'SELECT sample_id, sample_name, deduction_reason, deduction_points, risk_level FROM score_items WHERE record_id = ?',
        [record.id]
      );
      record.score_items = scoreItems;

      const exception = await db.get(
        'SELECT exception_type, error_message as exp_message, input_data FROM exception_records WHERE record_id = ?',
        [record.id]
      );
      record.exception = exception;
    }

    return await this.generateCSV(records, filters);
  }

  async generateCSV(records, filters) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const riskFilter = filters.risk_level ? `_${filters.risk_level}` : '';
    const fileName = `compatibility_scoring_${timestamp}${riskFilter}.csv`;
    const filePath = path.join(__dirname, '../../data/exports', fileName);

    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'batch_id', title: '批次ID' },
        { id: 'supplier_name', title: '供应商名称' },
        { id: 'supplier_dir_before', title: '供应商目录(修正前)' },
        { id: 'supplier_dir_after', title: '供应商目录(修正后)' },
        { id: 'total_score', title: '总分' },
        { id: 'risk_level', title: '风险等级' },
        { id: 'status', title: '状态' },
        { id: 'zip_path', title: '压缩包路径' },
        { id: 'error_message', title: '错误信息' },
        { id: 'score_details', title: '扣分详情' },
        { id: 'material_summary', title: '材料摘要' },
        { id: 'conclusion', title: '结论' },
        { id: 'created_at', title: '创建时间' }
      ]
    });

    const csvRecords = records.map(record => ({
      batch_id: record.batch_id,
      supplier_name: record.supplier_name,
      supplier_dir_before: record.supplier_dir_before,
      supplier_dir_after: record.supplier_dir_after,
      total_score: record.total_score || '',
      risk_level: record.risk_level,
      status: record.status,
      zip_path: record.zip_path,
      error_message: record.error_message || '',
      score_details: this.formatScoreItems(record.score_items),
      material_summary: record.material_summary || '',
      conclusion: record.conclusion || '',
      created_at: record.created_at
    }));

    await csvWriter.writeRecords(csvRecords);

    return {
      file_path: filePath,
      file_name: fileName,
      record_count: records.length
    };
  }

  formatScoreItems(scoreItems) {
    if (!scoreItems || scoreItems.length === 0) {
      return '无扣分';
    }
    return scoreItems.map(item => 
      `${item.sample_name}(${item.sample_id}): ${item.deduction_reason} -${item.deduction_points}分[${item.risk_level}]`
    ).join('; ');
  }

  async exportExceptionRecordsWithDetails() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `exception_records_${timestamp}.csv`;
    const filePath = path.join(__dirname, '../../data/exports', fileName);

    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'batch_id', title: '批次ID' },
        { id: 'supplier_name', title: '供应商名称' },
        { id: 'supplier_dir_before', title: '供应商目录(修正前)' },
        { id: 'supplier_dir_after', title: '供应商目录(修正后)' },
        { id: 'zip_path', title: '压缩包路径' },
        { id: 'exception_type', title: '异常类型' },
        { id: 'error_message', title: '错误信息' },
        { id: 'input_data', title: '输入数据' },
        { id: 'created_at', title: '创建时间' }
      ]
    });

    const records = await db.all(`
      SELECT 
        sr.batch_id,
        sr.supplier_name,
        sr.supplier_dir_before,
        sr.supplier_dir_after,
        sr.zip_path,
        er.exception_type,
        er.error_message,
        er.input_data,
        er.created_at
      FROM scoring_records sr
      JOIN exception_records er ON sr.id = er.record_id
      WHERE sr.status = 'failed'
      ORDER BY er.created_at DESC
    `);

    await csvWriter.writeRecords(records);

    return {
      file_path: filePath,
      file_name: fileName,
      record_count: records.length
    };
  }

  async getExportFiles() {
    const exportDir = path.join(__dirname, '../../data/exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    const files = fs.readdirSync(exportDir)
      .filter(file => file.endsWith('.csv'))
      .map(file => ({
        file_name: file,
        path: path.join(exportDir, file)
      }))
      .sort((a, b) => fs.statSync(b.path).mtime - fs.statSync(a.path).mtime);

    return files;
  }

  async getExportDetailedReport(batchId) {
    const record = await db.get(`
      SELECT * FROM scoring_records WHERE batch_id = ?
    `, [batchId]);

    if (!record) {
      return null;
    }

    const scoreItems = await db.all(
      'SELECT * FROM score_items WHERE record_id = ?',
      [record.id]
    );

    const exception = await db.get(
      'SELECT * FROM exception_records WHERE record_id = ?',
      [record.id]
    );

    const samples = await db.all('SELECT * FROM review_samples');

    return {
      batch_id: record.batch_id,
      supplier_name: record.supplier_name,
      supplier_dir_before: record.supplier_dir_before,
      supplier_dir_after: record.supplier_dir_after,
      total_score: record.total_score,
      risk_level: record.risk_level,
      status: record.status,
      zip_path: record.zip_path,
      material_summary: record.material_summary,
      conclusion: record.conclusion,
      error_message: record.error_message,
      created_at: record.created_at,
      score_details: scoreItems.map(item => ({
        sample_id: item.sample_id,
        sample_name: item.sample_name,
        deduction_reason: item.deduction_reason,
        deduction_points: item.deduction_points,
        risk_level: item.risk_level
      })),
      exception: exception ? {
        type: exception.exception_type,
        message: exception.error_message,
        input_data: JSON.parse(exception.input_data || '{}')
      } : null,
      scoring_explanation: this.generateScoringExplanation(scoreItems, samples)
    };
  }

  generateScoringExplanation(scoreItems, samples) {
    const explanations = [];

    for (const item of scoreItems) {
      const sample = samples.find(s => s.id === item.sample_id);
      explanations.push({
        sample_id: item.sample_id,
        sample_name: item.sample_name,
        explanation: `扣分项来自样例【${item.sample_name}】(${item.sample_id})：${item.deduction_reason}。根据审核标准，此项扣除${item.deduction_points}分。该样例属于${item.risk_level === 'high' ? '高' : item.risk_level === 'medium' ? '中' : '低'}风险等级。`
      });
    }

    return explanations;
  }
}

module.exports = new ExportService();
