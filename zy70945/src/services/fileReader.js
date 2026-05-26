/**
 * 文件读取服务 - 支持 CSV 和 JSON 格式
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { v4: uuidv4 } = require('uuid');
const store = require('../models/store');

/**
 * 生成批次指纹 - 用于去重判断
 * 基于文件内容的哈希
 */
function generateBatchFingerprint(data) {
  const content = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `BATCH-${Math.abs(hash).toString(16).toUpperCase()}`;
}

/**
 * 解析装修申请 CSV
 * CSV 表头: application_id,owner_id,owner_name,address,area,start_date,end_date,deposit_amount,acceptance_status,has_water_electricity_report,has_facade_change,fire_facility_blocked,wall_type,remarks
 */
function parseDecorationCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    const errors = [];
    let lineNumber = 0;

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        lineNumber++;
        try {
          const record = {
            id: row.application_id || row.id || null,
            ownerId: row.owner_id || row.ownerId || '',
            ownerName: row.owner_name || row.ownerName || '',
            address: row.address || '',
            area: parseFloat(row.area) || 0,
            startDate: row.start_date || row.startDate || null,
            endDate: row.end_date || row.endDate || null,
            depositAmount: parseFloat(row.deposit_amount) || 0,
            depositBalance: parseFloat(row.deposit_amount) || 0,
            acceptanceStatus: row.acceptance_status || 'pending',
            hasWaterElectricityReport: row.has_water_electricity_report === 'true' || row.has_water_electricity_report === '1',
            hasFacadeChange: row.has_facade_change === 'true' || row.has_facade_change === '1',
            fireFacilityBlocked: row.fire_facility_blocked === 'true' || row.fire_facility_blocked === '1',
            wallType: row.wall_type || 'normal',
            remarks: row.remarks || '',
            source: 'csv_import',
            sourceLine: lineNumber,
            rawData: { ...row }
          };

          if (!record.ownerId && !record.address) {
            errors.push({ line: lineNumber, reason: '缺少业主ID或地址', raw: row });
            return;
          }

          results.push(record);
        } catch (e) {
          errors.push({ line: lineNumber, reason: e.message, raw: row });
        }
      })
      .on('end', () => {
        resolve({ success: results, errors });
      })
      .on('error', reject);
  });
}

/**
 * 解析巡检 JSON
 * 格式: [{ application_id, inspector, date, result, findings: [{item, status, description}], photos, remarks }]
 */
function parseInspectionJSON(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      const results = [];
      const errors = [];

      if (!Array.isArray(data)) {
        return reject(new Error('巡检数据必须是数组格式'));
      }

      data.forEach((item, index) => {
        try {
          if (!item.application_id && !item.applicationId) {
            errors.push({ index, reason: '缺少关联的装修申请ID', raw: item });
            return;
          }

          const record = {
            id: item.id || null,
            applicationId: item.application_id || item.applicationId,
            inspector: item.inspector || '未指定',
            date: item.date || new Date().toISOString(),
            result: item.result || 'pending',
            findings: item.findings || [],
            photos: item.photos || [],
            remarks: item.remarks || '',
            source: 'json_import',
            sourceIndex: index,
            rawData: { ...item }
          };

          results.push(record);
        } catch (e) {
          errors.push({ index, reason: e.message, raw: item });
        }
      });

      resolve({ success: results, errors });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * 解析扣款规则 JSON
 * 格式: [{ name, type, condition: {item, value, check}, penalty: {amount, freezeDeposit, rejectRefund, description}, priority }]
 */
function parseDeductionRulesJSON(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      const results = [];
      const errors = [];

      if (!Array.isArray(data)) {
        return reject(new Error('扣款规则必须是数组格式'));
      }

      data.forEach((item, index) => {
        try {
          if (!item.name || !item.type || !item.condition) {
            errors.push({ index, reason: '规则名称、类型和条件不能为空', raw: item });
            return;
          }

          const validTypes = ['violation_recheck', 'deposit_check', 'refund_check'];
          if (!validTypes.includes(item.type)) {
            errors.push({ index, reason: `无效的规则类型: ${item.type}`, raw: item });
            return;
          }

          const record = {
            id: item.id || null,
            name: item.name,
            type: item.type,
            condition: item.condition,
            penalty: item.penalty || {},
            priority: item.priority || 99,
            active: item.active !== false,
            source: 'json_import',
            sourceIndex: index,
            rawData: { ...item }
          };

          results.push(record);
        } catch (e) {
          errors.push({ index, reason: e.message, raw: item });
        }
      });

      resolve({ success: results, errors });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * 从上传目录读取文件
 */
function getUploadDir() {
  const dir = path.join(__dirname, '..', '..', 'uploads');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * 读取并解析上传的文件
 */
async function processUploadedFile(filePath, fileType) {
  switch (fileType) {
    case 'csv':
    case 'decoration':
      return await parseDecorationCSV(filePath);
    case 'inspection':
      return await parseInspectionJSON(filePath);
    case 'rules':
    case 'deduction':
      return await parseDeductionRulesJSON(filePath);
    default:
      throw new Error(`不支持的文件类型: ${fileType}`);
  }
}

module.exports = {
  generateBatchFingerprint,
  parseDecorationCSV,
  parseInspectionJSON,
  parseDeductionRulesJSON,
  processUploadedFile,
  getUploadDir
};
