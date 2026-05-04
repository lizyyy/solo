const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const iconv = require('iconv-lite');

/**
 * 读取CSV文件
 * @param {string} filePath - CSV文件路径
 * @returns {Promise<Object>} 包含数据和警告的对象
 */
async function readCsv(filePath) {
  const results = [];
  const warnings = [];
  
  return new Promise((resolve, reject) => {
    const fileName = path.basename(filePath);
    
    // 检测文件编码
    const buffer = fs.readFileSync(filePath);
    const hasBom = buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF;
    let content;
    
    if (hasBom) {
      content = iconv.decode(buffer.slice(3), 'utf8');
    } else {
      // 尝试UTF-8，如果失败则尝试GBK
      try {
        content = iconv.decode(buffer, 'utf8');
        // 检查是否有乱码
        if (content.includes('�') || content.includes('?')) {
          throw new Error('可能不是UTF-8编码');
        }
      } catch (e) {
        content = iconv.decode(buffer, 'gbk');
      }
    }
    
    // 将内容转换为可读流
    const { Readable } = require('stream');
    const stream = Readable.from(content);
    
    stream
      .pipe(csv({
        mapHeaders: ({ header }) => header.trim(),
        mapValues: ({ header, value, index }) => {
          const trimmed = value.trim();
          if (trimmed === '' || trimmed === '-' || trimmed === 'N/A') {
            return null;
          }
          return trimmed;
        }
      }))
      .on('headers', (headers) => {
        // 检查必要的表头
        const requiredHeaders = ['SKU', '产品名称', '数量', '单价'];
        const missing = requiredHeaders.filter(h => !headers.includes(h) && !headers.some(hh => hh.toLowerCase().includes(h.toLowerCase())));
        if (missing.length > 0) {
          warnings.push({
            file: fileName,
            type: 'header_warning',
            message: `CSV表头可能缺少关键字段: ${missing.join(', ')}，请检查字段映射`,
            severity: 'medium'
          });
        }
      })
      .on('data', (data) => {
        results.push(data);
      })
      .on('end', () => {
        // 检查重复的SKU
        const skuMap = new Map();
        results.forEach((row, index) => {
          const sku = row.SKU || row.sku || row['SKU编号'];
          if (sku) {
            if (skuMap.has(sku)) {
              warnings.push({
                file: fileName,
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
        });
        
        // 检查数字字段的有效性
        const numberFields = ['数量', '单价', '折扣', '税率', '金额', '总价'];
        results.forEach((row, index) => {
          numberFields.forEach(field => {
            if (row[field]) {
              const cleaned = String(row[field]).replace(/[,￥$%]/g, '');
              const num = parseFloat(cleaned);
              if (isNaN(num)) {
                warnings.push({
                  file: fileName,
                  type: 'invalid_number',
                  message: `行 ${index + 2} 的 [${field}] 字段值 [${row[field]}] 不是有效的数字`,
                  line: index + 2,
                  severity: 'high',
                  field: field,
                  value: row[field]
                });
              }
            }
          });
        });
        
        resolve({
          data: results,
          warnings,
          format: 'csv',
          fileName
        });
      })
      .on('error', (error) => {
        reject({
          file: fileName,
          error: error.message,
          type: 'read_error'
        });
      });
  });
}

module.exports = { readCsv };
