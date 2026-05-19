const fs = require('fs');
const path = require('path');
const { initializeDatabase } = require('../models/database');
const { createPhotoRecord } = require('../services/photoService');
const { recordImportError, getImportErrors } = require('../services/errorService');

function importPhotos(filePath, operator, role) {
  return new Promise((resolve, reject) => {
    initializeDatabase();
    
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    
    if (!fs.existsSync(absolutePath)) {
      reject(new Error(`文件不存在: ${absolutePath}`));
      return;
    }
    
    try {
      const rawData = fs.readFileSync(absolutePath, 'utf8');
      const records = JSON.parse(rawData);
      
      const results = [];
      const errors = [];
      
      if (!Array.isArray(records)) {
        reject(new Error('JSON文件格式错误，必须是数组格式'));
        return;
      }
      
      records.forEach((data, index) => {
        const rowNumber = index + 2;
        try {
          const requiredFields = ['arrival_order_id', 'photo_path', 'photo_type', 'uploaded_by'];
          const missingFields = requiredFields.filter(field => !data[field]);
          
          if (missingFields.length > 0) {
            throw new Error(`缺少必填字段: ${missingFields.join(', ')}`);
          }
          
          const result = createPhotoRecord(data, operator, role);
          results.push({ rowNumber, data: result, success: true });
        } catch (error) {
          recordImportError(
            'photo',
            path.basename(absolutePath),
            rowNumber,
            data,
            error.message,
            '请检查照片类型是否正确，路径是否有效'
          );
          errors.push({ rowNumber, data, error: error.message, success: false });
        }
      });
      
      resolve({
        total: results.length + errors.length,
        success: results.length,
        failed: errors.length,
        results,
        errors
      });
    } catch (error) {
      reject(error);
    }
  });
}

if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log('用法: node src/scripts/importPhotos.js <json文件路径> <操作人> <角色>');
    console.log('示例: node src/scripts/importPhotos.js data/samples/photos_normal.json 王审核 reviewer');
    console.log('\n照片类型: package(包装), damage(破损), receipt(签收)');
    process.exit(1);
  }
  
  const [filePath, operator, role] = args;
  
  importPhotos(filePath, operator, role)
    .then(result => {
      console.log('\n=== 照片记录导入结果 ===');
      console.log(`总计: ${result.total} 条`);
      console.log(`成功: ${result.success} 条`);
      console.log(`失败: ${result.failed} 条`);
      
      if (result.errors.length > 0) {
        console.log('\n=== 错误详情 ===');
        result.errors.forEach(err => {
          console.log(`记录 ${err.rowNumber - 1}: ${err.error}`);
          console.log(`  原始数据: ${JSON.stringify(err.data)}`);
        });
      }
      
      const unresolvedErrors = getImportErrors({ importType: 'photo', resolved: false });
      console.log(`\n未解决的历史错误: ${unresolvedErrors.length} 条`);
      
      process.exit(0);
    })
    .catch(error => {
      console.error('导入失败:', error.message);
      process.exit(1);
    });
}

module.exports = { importPhotos };
