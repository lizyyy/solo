const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

/**
 * 读取Excel文件
 * @param {string} filePath - Excel文件路径
 * @returns {Promise<Object>} 包含数据和警告的对象
 */
async function readXlsx(filePath) {
  const warnings = [];
  const fileName = path.basename(filePath);
  
  try {
    // 读取Excel文件
    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // 获取第一个工作表（或者寻找包含报价数据的工作表）
    let targetSheet = null;
    let targetSheetName = '';
    
    // 优先查找包含"报价"、"报价单"、"价格"、"报价清单"的工作表
    const prioritySheets = ['报价单', '报价', '价格表', '产品清单', '报价清单'];
    for (const sheetName of workbook.SheetNames) {
      if (prioritySheets.some(p => sheetName.includes(p))) {
        targetSheet = workbook.Sheets[sheetName];
        targetSheetName = sheetName;
        break;
      }
    }
    
    // 如果没找到，使用第一个工作表
    if (!targetSheet) {
      targetSheet = workbook.Sheets[workbook.SheetNames[0]];
      targetSheetName = workbook.SheetNames[0];
      warnings.push({
        file: fileName,
        type: 'sheet_warning',
        message: `未找到明确的报价单工作表，使用第一个工作表: ${targetSheetName}`,
        severity: 'low'
      });
    }
    
    // 转换为JSON
    const jsonData = XLSX.utils.sheet_to_json(targetSheet, {
      defval: null,
      raw: false
    });
    
    // 数据清洗和验证
    const cleanedData = [];
    const skuMap = new Map();
    const numberFields = ['数量', '单价', '折扣', '税率', '金额', '总价', '含税金额', '不含税金额'];
    
    jsonData.forEach((row, index) => {
      const cleanedRow = {};
      
      // 清洗数据
      Object.keys(row).forEach(key => {
        const trimmedKey = key.trim();
        let value = row[key];
        
        if (value !== null && value !== undefined) {
          value = String(value).trim();
          if (value === '' || value === '-' || value === 'N/A' || value === 'null') {
            value = null;
          }
        }
        
        cleanedRow[trimmedKey] = value;
      });
      
      // 检查重复SKU
      const sku = cleanedRow.SKU || cleanedRow.sku || cleanedRow['SKU编号'] || cleanedRow['产品编码'];
      if (sku) {
        if (skuMap.has(sku)) {
          warnings.push({
            file: fileName,
            sheet: targetSheetName,
            type: 'duplicate_sku',
            message: `SKU [${sku}] 重复出现，行号: ${skuMap.get(sku) + 2} 和 ${index + 2}`,
            line: index + 2,
            severity: 'high',
            field: 'SKU'
          });
        } else {
          skuMap.set(sku, index);
        }
      }
      
      // 检查数字字段有效性
      numberFields.forEach(field => {
        if (cleanedRow[field]) {
          let cleaned = String(cleanedRow[field]).replace(/[,￥$%元]/g, '');
          // 处理百分比
          if (String(cleanedRow[field]).includes('%')) {
            const num = parseFloat(cleaned);
            if (!isNaN(num)) {
              cleanedRow[field + '_percent'] = num / 100;
            }
          }
          const num = parseFloat(cleaned);
          if (isNaN(num)) {
            warnings.push({
              file: fileName,
              sheet: targetSheetName,
              type: 'invalid_number',
              message: `行 ${index + 2} 的 [${field}] 字段值 [${cleanedRow[field]}] 不是有效的数字`,
              line: index + 2,
              severity: 'high',
              field: field,
              value: cleanedRow[field]
            });
          }
        }
      });
      
      cleanedData.push(cleanedRow);
    });
    
    return {
      data: cleanedData,
      warnings,
      format: 'xlsx',
      fileName,
      sheetName: targetSheetName,
      workbookInfo: {
        sheetNames: workbook.SheetNames
      }
    };
    
  } catch (error) {
    throw {
      file: fileName,
      error: error.message,
      type: 'read_error',
      stack: error.stack
    };
  }
}

module.exports = { readXlsx };
