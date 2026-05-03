const csv = require('csv-parser');
const fs = require('fs');
const { PassThrough } = require('stream');
const path = require('path');

/**
 * CSV解析器
 * 用于解析器材台账和厂家召回清单等CSV文件
 */

/**
 * 解析CSV文件
 * 支持文件路径、字符串内容或Buffer
 * @param {string|Buffer} input - 文件路径或CSV内容
 * @param {Object} options - 解析选项
 * @returns {Promise<Array>} 解析后的数据数组
 */
function parseCSV(input, options = {}) {
  return new Promise((resolve, reject) => {
    const results = [];
    let stream;
    
    // 检查是否是文件路径
    if (typeof input === 'string' && 
        (input.length < 1000) && 
        (input.includes('.csv') || input.includes('/') || input.includes('\\'))) {
      try {
        // 尝试作为文件路径读取
        const absolutePath = path.isAbsolute(input) ? input : path.resolve(input);
        if (fs.existsSync(absolutePath)) {
          stream = fs.createReadStream(absolutePath, 'utf8');
        } else {
          // 文件不存在，作为字符串内容处理
          stream = new PassThrough();
          stream.end(input, 'utf8');
        }
      } catch (err) {
        // 读取文件失败，作为字符串内容处理
        stream = new PassThrough();
        stream.end(input, 'utf8');
      }
    } else if (Buffer.isBuffer(input)) {
      // Buffer
      stream = new PassThrough();
      stream.end(input);
    } else {
      // 字符串内容
      stream = new PassThrough();
      stream.end(input, 'utf8');
    }
    
    const csvOptions = {};
    
    if (options.separator) {
      csvOptions.separator = options.separator;
    }
    
    if (options.skipLines) {
      csvOptions.skipLines = options.skipLines;
    }
    
    if (options.headers !== undefined) {
      csvOptions.headers = options.headers;
    }
    
    if (options.mapHeaders) {
      csvOptions.mapHeaders = options.mapHeaders;
    }
    
    if (options.mapValues) {
      csvOptions.mapValues = options.mapValues;
    }
    
    stream
      .pipe(csv(csvOptions))
      .on('data', (data) => {
        // 过滤掉空行
        const hasData = Object.values(data).some(v => v && v.trim() !== '');
        if (hasData) {
          results.push(data);
        }
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(new Error(`CSV解析失败: ${error.message}`));
      });
  });
}

/**
 * 解析器材台账CSV
 * @param {string|Buffer} csvContent - CSV文件内容
 * @returns {Promise<{success: boolean, data: Array, errors: Array}>}
 */
async function parseEquipmentCSV(csvContent) {
  const errors = [];
  const validData = [];
  
  try {
    const rawData = await parseCSV(csvContent);
    
    if (rawData.length === 0) {
      errors.push('CSV文件为空或格式错误');
      return { success: false, data: [], errors };
    }
    
    // 可能的列名映射（支持不同的命名方式）
    const columnMappings = {
      'equipment_code': ['器材编号', '设备编号', 'equipment_code', 'code', '编号'],
      'batch_number': ['批次号', 'batch_number', 'batch', '批次'],
      'equipment_type': ['器材类型', '器材名称', 'equipment_type', 'type', '类型', '名称'],
      'model': ['型号', '规格型号', 'model', '规格'],
      'manufacturer': ['生产厂家', 'manufacturer', '厂家', '生产厂商', '厂商'],
      'production_date': ['生产日期', 'production_date', '生产时间'],
      'purchase_date': ['购买日期', 'purchase_date', '采购日期'],
      'expiration_date': ['有效期至', '有效期限', 'expiration_date', '有效期', '报废日期'],
      'location': ['存放位置', '放置位置', 'location', '位置', '存放地点'],
      'status': ['状态', 'status'],
      'is_scrapped': ['是否报废', 'is_scrapped', '已报废']
    };
    
    // 解析每一行数据
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNumber = i + 1;
      
      try {
        // 构建实际列名到标准列名的映射（基于当前行的列）
        const actualColumns = Object.keys(row);
        const columnMap = {};
        
        for (const [standardName, possibleNames] of Object.entries(columnMappings)) {
          for (const possibleName of possibleNames) {
            const matchedColumn = actualColumns.find(
              col => col.toLowerCase() === possibleName.toLowerCase()
            );
            if (matchedColumn) {
              columnMap[standardName] = matchedColumn;
              break;
            }
          }
        }
        
        const equipment = {
          equipment_code: columnMap.equipment_code ? (row[columnMap.equipment_code]?.trim() || '') : '',
          batch_number: columnMap.batch_number ? (row[columnMap.batch_number]?.trim() || '') : '',
          equipment_type: columnMap.equipment_type ? (row[columnMap.equipment_type]?.trim() || '') : '',
          model: columnMap.model ? (row[columnMap.model]?.trim() || '') : '',
          manufacturer: columnMap.manufacturer ? (row[columnMap.manufacturer]?.trim() || '') : '',
          production_date: columnMap.production_date ? (row[columnMap.production_date]?.trim() || null) : null,
          purchase_date: columnMap.purchase_date ? (row[columnMap.purchase_date]?.trim() || null) : null,
          expiration_date: columnMap.expiration_date ? (row[columnMap.expiration_date]?.trim() || null) : null,
          location: columnMap.location ? (row[columnMap.location]?.trim() || null) : null,
          status: columnMap.status ? (row[columnMap.status]?.trim() || 'normal') : 'normal',
          is_scrapped: 0
        };
        
        // 解析是否报废
        if (columnMap.is_scrapped) {
          const scrappedValue = row[columnMap.is_scrapped]?.toString().toLowerCase().trim();
          equipment.is_scrapped = scrappedValue === '是' || 
                                    scrappedValue === 'true' || 
                                    scrappedValue === '1' ||
                                    scrappedValue === '已报废' ? 1 : 0;
        }
        
        validData.push(equipment);
      } catch (error) {
        errors.push(`第${rowNumber}行错误: ${error.message}`);
      }
    }
    
    return {
      success: true,
      data: validData,
      errors
    };
    
  } catch (error) {
    errors.push(`解析失败: ${error.message}`);
    return { success: false, data: [], errors };
  }
}

/**
 * 解析厂家召回清单CSV
 * @param {string|Buffer} csvContent - CSV文件内容
 * @returns {Promise<{success: boolean, data: Array, errors: Array}>}
 */
async function parseRecallCSV(csvContent) {
  const errors = [];
  const validData = [];
  
  try {
    const rawData = await parseCSV(csvContent);
    
    if (rawData.length === 0) {
      errors.push('CSV文件为空或格式错误');
      return { success: false, data: [], errors };
    }
    
    // 列名映射
    const columnMappings = {
      'recall_code': ['召回编号', 'recall_code', '通知编号', '编号'],
      'manufacturer': ['生产厂家', 'manufacturer', '厂家', '生产厂商'],
      'recall_reason': ['召回原因', 'recall_reason', '原因'],
      'recall_date': ['召回日期', 'recall_date', '发布日期'],
      'deadline_date': ['整改期限', 'deadline_date', '截止日期', '最后期限'],
      'affected_batches': ['涉及批次', 'affected_batches', '批次号', '批次'],
      'priority': ['紧急程度', 'priority', '优先级'],
      'status': ['状态', 'status']
    };
    
    // 解析每一行
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNumber = i + 1;
      
      try {
        const actualColumns = Object.keys(row);
        const columnMap = {};
        
        // 构建列名映射
        for (const [standardName, possibleNames] of Object.entries(columnMappings)) {
          for (const possibleName of possibleNames) {
            const matchedColumn = actualColumns.find(
              col => col.toLowerCase() === possibleName.toLowerCase()
            );
            if (matchedColumn) {
              columnMap[standardName] = matchedColumn;
              break;
            }
          }
        }
        
        // 解析涉及批次（支持逗号、分号分隔）
        let affectedBatches = [];
        if (columnMap.affected_batches) {
          const batchesStr = row[columnMap.affected_batches]?.trim() || '';
          if (batchesStr) {
            affectedBatches = batchesStr
              .split(/[,，;；]/)
              .map(b => b.trim())
              .filter(b => b !== '');
          }
        }
        
        const recall = {
          recall_code: columnMap.recall_code ? (row[columnMap.recall_code]?.trim() || '') : '',
          manufacturer: columnMap.manufacturer ? (row[columnMap.manufacturer]?.trim() || '') : '',
          recall_reason: columnMap.recall_reason ? (row[columnMap.recall_reason]?.trim() || '') : '',
          recall_date: columnMap.recall_date ? (row[columnMap.recall_date]?.trim() || null) : null,
          deadline_date: columnMap.deadline_date ? (row[columnMap.deadline_date]?.trim() || '') : '',
          affected_batches: affectedBatches,
          priority: columnMap.priority ? (row[columnMap.priority]?.trim() || null) : null,
          status: columnMap.status ? (row[columnMap.status]?.trim() || 'active') : 'active'
        };
        
        validData.push(recall);
      } catch (error) {
        errors.push(`第${rowNumber}行错误: ${error.message}`);
      }
    }
    
    return {
      success: true,
      data: validData,
      errors
    };
    
  } catch (error) {
    errors.push(`解析失败: ${error.message}`);
    return { success: false, data: [], errors };
  }
}

module.exports = {
  parseCSV,
  parseEquipmentCSV,
  parseRecallCSV
};
