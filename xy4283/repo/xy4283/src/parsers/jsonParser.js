const fs = require('fs');
const path = require('path');

/**
 * JSON解析器
 * 用于解析巡检记录等JSON文件
 */

/**
 * 解析JSON
 * 支持文件路径、字符串内容或Buffer
 * @param {string|Buffer} input - 文件路径或JSON内容
 * @returns {Promise<any>} 解析后的对象
 */
function parseJSON(input) {
  return new Promise((resolve, reject) => {
    try {
      let content;
      
      // 检查是否是文件路径
      if (typeof input === 'string' && 
          (input.length < 1000) && 
          (input.includes('.json') || input.includes('/') || input.includes('\\'))) {
        try {
          // 尝试作为文件路径读取
          const absolutePath = path.isAbsolute(input) ? input : path.resolve(input);
          if (fs.existsSync(absolutePath)) {
            content = fs.readFileSync(absolutePath, 'utf8');
          } else {
            // 文件不存在，作为字符串内容处理
            content = input;
          }
        } catch (err) {
          // 读取文件失败，作为字符串内容处理
          content = input;
        }
      } else if (Buffer.isBuffer(input)) {
        // Buffer
        content = input.toString('utf8');
      } else {
        // 字符串内容
        content = input;
      }
      
      const parsed = JSON.parse(content);
      resolve(parsed);
    } catch (error) {
      reject(new Error(`JSON解析失败: ${error.message}`));
    }
  });
}

/**
 * 解析巡检记录JSON
 * @param {string|Buffer} jsonContent - JSON文件内容
 * @returns {Promise<{success: boolean, data: Array, errors: Array}>}
 */
async function parseInspectionJSON(jsonContent) {
  const errors = [];
  const validData = [];
  
  try {
    let parsedData = await parseJSON(jsonContent);
    
    // 支持多种数据结构
    // 1. 直接是数组
    // 2. 包含data/inspections/records字段的对象
    if (!Array.isArray(parsedData)) {
      if (parsedData.data && Array.isArray(parsedData.data)) {
        parsedData = parsedData.data;
      } else if (parsedData.inspections && Array.isArray(parsedData.inspections)) {
        parsedData = parsedData.inspections;
      } else if (parsedData.records && Array.isArray(parsedData.records)) {
        parsedData = parsedData.records;
      } else {
        errors.push('JSON格式错误：期望是数组或包含data/inspections/records字段的对象');
        return { success: false, data: [], errors };
      }
    }
    
    if (parsedData.length === 0) {
      errors.push('巡检记录为空');
      return { success: false, data: [], errors };
    }
    
    // 解析每一条巡检记录
    for (let i = 0; i < parsedData.length; i++) {
      const record = parsedData[i];
      const recordNumber = i + 1;
      
      try {
        const inspection = await validateAndTransformInspection(record, recordNumber);
        validData.push(inspection);
      } catch (error) {
        errors.push(`第${recordNumber}条记录错误: ${error.message}`);
      }
    }
    
    return {
      success: errors.length === 0,
      data: validData,
      errors
    };
    
  } catch (error) {
    errors.push(`解析失败: ${error.message}`);
    return { success: false, data: [], errors };
  }
}

/**
 * 验证并转换巡检记录
 * @param {Object} record - 原始记录对象
 * @param {number} recordNumber - 记录序号
 * @returns {Object} 转换后的巡检记录对象
 */
function validateAndTransformInspection(record, recordNumber) {
  // 字段映射（支持多种命名方式）
  const fieldMappings = {
    'equipment_code': ['器材编号', '设备编号', 'equipment_code', 'code', 'equipmentCode', '编号'],
    'inspection_date': ['巡检日期', '检查日期', 'inspection_date', 'inspectionDate', '日期'],
    'inspector': ['巡检员', '检查人', 'inspector', '检查人员'],
    'status': ['整体状态', '状态', 'status', 'overallStatus'],
    'pressure_status': ['压力状态', 'pressure_status', 'pressureStatus', '压力'],
    'hose_status': ['软管状态', 'hose_status', 'hoseStatus', '软管'],
    'nozzle_status': ['喷嘴状态', 'nozzle_status', 'nozzleStatus', '喷嘴'],
    'safety_pin_status': ['保险销状态', 'safety_pin_status', 'safetyPinStatus', '保险销'],
    'appearance_status': ['外观状态', 'appearance_status', 'appearanceStatus', '外观'],
    'weight_status': ['重量状态', 'weight_status', 'weightStatus', '重量'],
    'maintenance_suggestion': ['维护建议', '处理建议', 'maintenance_suggestion', 'maintenanceSuggestion', '建议'],
    'next_inspection_date': ['下次巡检日期', '下次检查日期', 'next_inspection_date', 'nextInspectionDate']
  };
  
  // 查找字段值
  function getFieldValue(fieldName) {
    const possibleNames = fieldMappings[fieldName] || [fieldName];
    for (const name of possibleNames) {
      // 支持多种键名格式
      const keys = [name, name.toLowerCase(), name.replace(/_/g, ''), name.replace(/-/g, '_')];
      for (const key of keys) {
        if (record[key] !== undefined && record[key] !== null) {
          return record[key];
        }
        // 检查驼峰命名
        const camelKey = name.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        if (record[camelKey] !== undefined && record[camelKey] !== null) {
          return record[camelKey];
        }
      }
    }
    return undefined;
  }
  
  // 提取字段
  const equipmentCode = getFieldValue('equipment_code')?.toString().trim() || '';
  const inspectionDate = getFieldValue('inspection_date')?.toString().trim() || '';
  const inspector = getFieldValue('inspector')?.toString().trim() || null;
  const status = getFieldValue('status')?.toString().trim() || 'normal';
  const pressureStatus = getFieldValue('pressure_status')?.toString().trim() || null;
  const hoseStatus = getFieldValue('hose_status')?.toString().trim() || null;
  const nozzleStatus = getFieldValue('nozzle_status')?.toString().trim() || null;
  const safetyPinStatus = getFieldValue('safety_pin_status')?.toString().trim() || null;
  const appearanceStatus = getFieldValue('appearance_status')?.toString().trim() || null;
  const weightStatus = getFieldValue('weight_status')?.toString().trim() || null;
  const maintenanceSuggestion = getFieldValue('maintenance_suggestion')?.toString().trim() || null;
  const nextInspectionDate = getFieldValue('next_inspection_date')?.toString().trim() || null;
  
  // 验证必填字段
  if (!equipmentCode) {
    throw new Error('器材编号不能为空');
  }
  if (!inspectionDate) {
    throw new Error('巡检日期不能为空');
  }
  
  // 构建巡检记录对象
  return {
    equipment_code: equipmentCode,
    inspection_date: inspectionDate,
    inspector,
    status,
    pressure_status: pressureStatus,
    hose_status: hoseStatus,
    nozzle_status: nozzleStatus,
    safety_pin_status: safetyPinStatus,
    appearance_status: appearanceStatus,
    weight_status: weightStatus,
    maintenance_suggestion: maintenanceSuggestion,
    next_inspection_date: nextInspectionDate
  };
}

/**
 * 解析召回清单JSON
 * @param {string|Buffer} jsonContent - JSON文件内容
 * @returns {Promise<{success: boolean, data: Array, errors: Array}>}
 */
async function parseRecallJSON(jsonContent) {
  const errors = [];
  const validData = [];
  
  try {
    let parsedData = await parseJSON(jsonContent);
    
    // 支持多种数据结构
    if (!Array.isArray(parsedData)) {
      if (parsedData.data && Array.isArray(parsedData.data)) {
        parsedData = parsedData.data;
      } else if (parsedData.recalls && Array.isArray(parsedData.recalls)) {
        parsedData = parsedData.recalls;
      } else if (parsedData.records && Array.isArray(parsedData.records)) {
        parsedData = parsedData.records;
      } else {
        errors.push('JSON格式错误：期望是数组或包含data/recalls/records字段的对象');
        return { success: false, data: [], errors };
      }
    }
    
    if (parsedData.length === 0) {
      errors.push('召回清单为空');
      return { success: false, data: [], errors };
    }
    
    // 解析每一条召回记录
    for (let i = 0; i < parsedData.length; i++) {
      const record = parsedData[i];
      const recordNumber = i + 1;
      
      try {
        const recall = await validateAndTransformRecall(record, recordNumber);
        validData.push(recall);
      } catch (error) {
        errors.push(`第${recordNumber}条记录错误: ${error.message}`);
      }
    }
    
    return {
      success: errors.length === 0,
      data: validData,
      errors
    };
    
  } catch (error) {
    errors.push(`解析失败: ${error.message}`);
    return { success: false, data: [], errors };
  }
}

/**
 * 验证并转换召回记录
 * @param {Object} record - 原始记录对象
 * @param {number} recordNumber - 记录序号
 * @returns {Object} 转换后的召回记录对象
 */
function validateAndTransformRecall(record, recordNumber) {
  // 提取字段
  const recallCode = (record.recall_code || record.recallCode || record.召回编号 || record.编号)?.toString().trim() || '';
  const manufacturer = (record.manufacturer || record.生产厂家 || record.厂家)?.toString().trim() || '';
  const recallReason = (record.recall_reason || record.recallReason || record.召回原因 || record.原因)?.toString().trim() || '';
  const recallDate = (record.recall_date || record.recallDate || record.召回日期 || record.发布日期)?.toString().trim() || new Date().toISOString().split('T')[0];
  const deadlineDate = (record.deadline_date || record.deadlineDate || record.整改期限 || record.截止日期)?.toString().trim() || '';
  
  // 处理涉及批次
  let affectedBatches = [];
  const batches = record.affected_batches || record.affectedBatches || record.涉及批次 || record.批次号 || record.批次;
  
  if (batches) {
    if (Array.isArray(batches)) {
      affectedBatches = batches.map(b => b.toString().trim()).filter(b => b !== '');
    } else {
      // 字符串形式，支持逗号、分号分隔
      affectedBatches = batches.toString()
        .split(/[,，;；]/)
        .map(b => b.trim())
        .filter(b => b !== '');
    }
  }
  
  // 验证必填字段
  if (!recallCode) {
    throw new Error('召回编号不能为空');
  }
  if (!manufacturer) {
    throw new Error('生产厂家不能为空');
  }
  if (!recallReason) {
    throw new Error('召回原因不能为空');
  }
  if (!deadlineDate) {
    throw new Error('整改期限不能为空');
  }
  if (affectedBatches.length === 0) {
    throw new Error('涉及批次不能为空');
  }
  
  return {
    recall_code: recallCode,
    manufacturer,
    recall_reason: recallReason,
    recall_date: recallDate,
    deadline_date: deadlineDate,
    affected_batches: affectedBatches,
    status: 'active'
  };
}

module.exports = {
  parseJSON,
  parseInspectionJSON,
  parseRecallJSON
};
