const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const path = require('path');

// 配置multer存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    // 确保上传目录存在
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 生成唯一文件名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

// 文件过滤器，只接受CSV和JSON文件
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.csv', '.json'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('只支持CSV和JSON格式的文件'), false);
  }
};

// 配置multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 限制10MB
  }
});

// 解析CSV文件
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => {
        // 标准化字段名，处理可能的不同命名
        const standardized = {
          boxNumber: data.箱号 || data.box_number || data.boxNumber || data['箱号'] || '',
          artifactNumber: data.藏品号 || data.artifact_number || data.artifactNumber || data['藏品号'] || '',
          insuranceValue: parseFloat(data.保险值 || data.insurance_value || data.insuranceValue || data['保险值'] || 0),
          location: data.库位 || data.location || data['库位'] || '',
          hasCertificate: data.状态 || data.status || data['状态'] || data.有证 || data['有证'] || '0',
          notes: data.备注 || data.notes || data['备注'] || '',
          originalRow: results.length + 1
        };
        
        // 转换保险值为数字
        standardized.insuranceValue = isNaN(standardized.insuranceValue) ? 0 : standardized.insuranceValue;
        
        // 转换有证状态
        standardized.hasCertificate = standardized.hasCertificate === '是' || 
                                        standardized.hasCertificate === '有' || 
                                        standardized.hasCertificate === '1' || 
                                        standardized.hasCertificate === true ||
                                        standardized.hasCertificate === 1;
        
        results.push(standardized);
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

// 解析JSON文件
function parseJSON(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      
      try {
        const jsonData = JSON.parse(data);
        const results = [];
        
        // 处理数组格式
        if (Array.isArray(jsonData)) {
          jsonData.forEach((item, index) => {
            const standardized = {
              boxNumber: item.箱号 || item.box_number || item.boxNumber || item['箱号'] || '',
              artifactNumber: item.藏品号 || item.artifact_number || item.artifactNumber || item['藏品号'] || '',
              insuranceValue: parseFloat(item.保险值 || item.insurance_value || item.insuranceValue || item['保险值'] || 0),
              location: item.库位 || item.location || item['库位'] || '',
              hasCertificate: item.状态 || item.status || item['状态'] || item.有证 || item['有证'] || '0',
              notes: item.备注 || item.notes || item['备注'] || '',
              originalRow: index + 1
            };
            
            // 转换保险值为数字
            standardized.insuranceValue = isNaN(standardized.insuranceValue) ? 0 : standardized.insuranceValue;
            
            // 转换有证状态
            standardized.hasCertificate = standardized.hasCertificate === '是' || 
                                            standardized.hasCertificate === '有' || 
                                            standardized.hasCertificate === '1' || 
                                            standardized.hasCertificate === true ||
                                            standardized.hasCertificate === 1;
            
            results.push(standardized);
          });
        } 
        // 处理对象格式（可能包含data数组）
        else if (jsonData.data && Array.isArray(jsonData.data)) {
          jsonData.data.forEach((item, index) => {
            const standardized = {
              boxNumber: item.箱号 || item.box_number || item.boxNumber || item['箱号'] || '',
              artifactNumber: item.藏品号 || item.artifact_number || item.artifactNumber || item['藏品号'] || '',
              insuranceValue: parseFloat(item.保险值 || item.insurance_value || item.insuranceValue || item['保险值'] || 0),
              location: item.库位 || item.location || item['库位'] || '',
              hasCertificate: item.状态 || item.status || item['状态'] || item.有证 || item['有证'] || '0',
              notes: item.备注 || item.notes || item['备注'] || '',
              originalRow: index + 1
            };
            
            // 转换保险值为数字
            standardized.insuranceValue = isNaN(standardized.insuranceValue) ? 0 : standardized.insuranceValue;
            
            // 转换有证状态
            standardized.hasCertificate = standardized.hasCertificate === '是' || 
                                            standardized.hasCertificate === '有' || 
                                            standardized.hasCertificate === '1' || 
                                            standardized.hasCertificate === true ||
                                            standardized.hasCertificate === 1;
            
            results.push(standardized);
          });
        }
        // 单个对象格式
        else {
          const standardized = {
            boxNumber: jsonData.箱号 || jsonData.box_number || jsonData.boxNumber || jsonData['箱号'] || '',
            artifactNumber: jsonData.藏品号 || jsonData.artifact_number || jsonData.artifactNumber || jsonData['藏品号'] || '',
            insuranceValue: parseFloat(jsonData.保险值 || jsonData.insurance_value || jsonData.insuranceValue || jsonData['保险值'] || 0),
            location: jsonData.库位 || jsonData.location || jsonData['库位'] || '',
            hasCertificate: jsonData.状态 || jsonData.status || jsonData['状态'] || jsonData.有证 || jsonData['有证'] || '0',
            notes: jsonData.备注 || jsonData.notes || jsonData['备注'] || '',
            originalRow: 1
          };
          
          // 转换保险值为数字
          standardized.insuranceValue = isNaN(standardized.insuranceValue) ? 0 : standardized.insuranceValue;
          
          // 转换有证状态
          standardized.hasCertificate = standardized.hasCertificate === '是' || 
                                          standardized.hasCertificate === '有' || 
                                          standardized.hasCertificate === '1' || 
                                          standardized.hasCertificate === true ||
                                          standardized.hasCertificate === 1;
          
          results.push(standardized);
        }
        
        resolve(results);
      } catch (error) {
        reject(error);
      }
    });
  });
}

// 解析文件（根据扩展名选择解析方式）
async function parseFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const filePath = file.path;
  
  try {
    let results;
    
    if (ext === '.csv') {
      results = await parseCSV(filePath);
    } else if (ext === '.json') {
      results = await parseJSON(filePath);
    } else {
      throw new Error('不支持的文件格式');
    }
    
    return results;
  } catch (error) {
    console.error('文件解析错误:', error);
    throw error;
  }
}

module.exports = {
  upload,
  parseFile
};
