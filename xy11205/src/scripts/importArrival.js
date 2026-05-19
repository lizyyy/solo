const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { initializeDatabase } = require('../models/database');
const { createArrivalOrder, getArrivalOrders } = require('../services/arrivalService');
const { recordImportError, getImportErrors } = require('../services/errorService');

function importArrivalOrders(filePath, operator, role) {
  return new Promise((resolve, reject) => {
    initializeDatabase();
    
    const results = [];
    const errors = [];
    let rowNumber = 1;
    
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    
    if (!fs.existsSync(absolutePath)) {
      reject(new Error(`文件不存在: ${absolutePath}`));
      return;
    }
    
    fs.createReadStream(absolutePath)
      .pipe(csv())
      .on('headers', () => {
        rowNumber++;
      })
      .on('data', (data) => {
        try {
          const requiredFields = ['batch_number', 'product_type', 'product_name', 'quantity', 'arrival_date', 'receiver', 'signature'];
          const missingFields = requiredFields.filter(field => !data[field]);
          
          if (missingFields.length > 0) {
            throw new Error(`缺少必填字段: ${missingFields.join(', ')}`);
          }
          
          const result = createArrivalOrder(data, operator, role);
          results.push({ rowNumber, data: result, success: true });
        } catch (error) {
          recordImportError(
            'arrival',
            path.basename(absolutePath),
            rowNumber,
            data,
            error.message,
            '请检查必填字段是否完整，数据格式是否正确'
          );
          errors.push({ rowNumber, data, error: error.message, success: false });
        }
        rowNumber++;
      })
      .on('end', () => {
        resolve({
          total: results.length + errors.length,
          success: results.length,
          failed: errors.length,
          results,
          errors
        });
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log('用法: node src/scripts/importArrival.js <csv文件路径> <操作人> <角色>');
    console.log('示例: node src/scripts/importArrival.js data/samples/arrival_normal.csv 张药师 pharmacist');
    process.exit(1);
  }
  
  const [filePath, operator, role] = args;
  
  importArrivalOrders(filePath, operator, role)
    .then(result => {
      console.log('\n=== 到货单导入结果 ===');
      console.log(`总计: ${result.total} 条`);
      console.log(`成功: ${result.success} 条`);
      console.log(`失败: ${result.failed} 条`);
      
      if (result.errors.length > 0) {
        console.log('\n=== 错误详情 ===');
        result.errors.forEach(err => {
          console.log(`行 ${err.rowNumber}: ${err.error}`);
          console.log(`  原始数据: ${JSON.stringify(err.data)}`);
        });
      }
      
      const unresolvedErrors = getImportErrors({ importType: 'arrival', resolved: false });
      console.log(`\n未解决的历史错误: ${unresolvedErrors.length} 条`);
      
      process.exit(0);
    })
    .catch(error => {
      console.error('导入失败:', error.message);
      process.exit(1);
    });
}

module.exports = { importArrivalOrders };
