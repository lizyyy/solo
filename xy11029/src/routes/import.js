const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { runQuery, getQuery, allQuery } = require('../database/db');

const upload = multer({ dest: path.join(__dirname, '../../tmp/uploads') });

const REQUIRED_FIELDS = [
  'report_no', 'report_date', 'reporter_name', 'reporter_phone',
  'accident_time', 'accident_location', 'accident_type',
  'policy_no', 'insurance_company'
];

function validateReport(data) {
  const errors = [];
  
  for (const field of REQUIRED_FIELDS) {
    if (!data[field]) {
      errors.push(`缺少必填字段: ${field}`);
    }
  }
  
  if (data.report_date && !/^\d{4}-\d{2}-\d{2}$/.test(data.report_date)) {
    errors.push('报案日期格式错误，应为 YYYY-MM-DD');
  }
  
  if (data.reporter_phone && !/^1[3-9]\d{9}$/.test(data.reporter_phone)) {
    errors.push('手机号格式错误');
  }
  
  const validStatuses = ['pending', 'reviewing', 'approved', 'rejected', 'paid'];
  if (data.status && !validStatuses.includes(data.status)) {
    errors.push(`状态值无效，有效值为: ${validStatuses.join(', ')}`);
  }
  
  return errors;
}

async function checkClaimPackageConsistency(items) {
  const warnings = [];
  const packageGroups = {};
  
  for (const item of items) {
    if (item.claim_package_no) {
      if (!packageGroups[item.claim_package_no]) {
        packageGroups[item.claim_package_no] = [];
      }
      packageGroups[item.claim_package_no].push(item);
    }
  }
  
  const existingPackages = await allQuery(
    'SELECT DISTINCT claim_package_no, accident_time, accident_location FROM insurance_reports WHERE claim_package_no IS NOT NULL'
  );
  
  const existingPackageMap = {};
  for (const pkg of existingPackages) {
    existingPackageMap[pkg.claim_package_no] = pkg;
  }
  
  for (const [packageNo, packageItems] of Object.entries(packageGroups)) {
    if (packageItems.length > 1) {
      const firstItem = packageItems[0];
      
      for (let i = 1; i < packageItems.length; i++) {
        const item = packageItems[i];
        
        if (firstItem.accident_time !== item.accident_time) {
          warnings.push(`理赔包 ${packageNo}: 事故时间不一致 (${item.report_no})`);
        }
        if (firstItem.accident_location !== item.accident_location) {
          warnings.push(`理赔包 ${packageNo}: 事故地点不一致 (${item.report_no})`);
        }
      }
    }
    
    if (existingPackageMap[packageNo]) {
      const existing = existingPackageMap[packageNo];
      
      for (const item of packageItems) {
        if (existing.accident_time && item.accident_time !== existing.accident_time) {
          warnings.push(`理赔包 ${packageNo}: 与已有记录事故时间不一致 (${item.report_no})`);
        }
        if (existing.accident_location && item.accident_location !== existing.accident_location) {
          warnings.push(`理赔包 ${packageNo}: 与已有记录事故地点不一致 (${item.report_no})`);
        }
      }
    }
  }
  
  return warnings;
}

router.post('/batch', async (req, res) => {
  try {
    const { items, skip_on_error = true } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请提供要导入的数据数组'
      });
    }
    
    const consistencyWarnings = await checkClaimPackageConsistency(items);
    
    const results = [];
    let successCount = 0;
    let failCount = 0;
    let warningCount = consistencyWarnings.length;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rowResult = {
        row: i + 1,
        report_no: item.report_no,
        success: false,
        errors: [],
        warnings: []
      };
      
      const errors = validateReport(item);
      
      if (errors.length > 0) {
        rowResult.errors = errors;
        failCount++;
        results.push(rowResult);
        
        if (!skip_on_error) {
          return res.status(400).json({
            success: false,
            message: '导入中断，第 ' + (i + 1) + ' 行数据验证失败',
            results,
            summary: {
              total: items.length,
              success: successCount,
              failed: failCount,
              warnings: warningCount
            },
            consistency_warnings: consistencyWarnings
          });
        }
        continue;
      }
      
      try {
        const existing = await getQuery(
          'SELECT id FROM insurance_reports WHERE report_no = ?',
          [item.report_no]
        );
        
        if (existing) {
          rowResult.errors.push('报案编号已存在');
          failCount++;
          results.push(rowResult);
          continue;
        }
        
        const data = { ...item };
        data.created_at = new Date().toISOString();
        data.updated_at = new Date().toISOString();
        
        if (data.photo_source) {
          rowResult.warnings.push(`照片来源: ${data.photo_source}`);
        }
        
        const columns = Object.keys(data).filter(k => data[k] !== undefined && data[k] !== null).join(', ');
        const placeholders = Object.keys(data).filter(k => data[k] !== undefined && data[k] !== null).map(() => '?').join(', ');
        const values = Object.values(data).filter(v => v !== undefined && v !== null);
        
        await runQuery(
          `INSERT INTO insurance_reports (${columns}) VALUES (${placeholders})`,
          values
        );
        
        rowResult.success = true;
        successCount++;
        results.push(rowResult);
      } catch (error) {
        rowResult.errors.push(error.message);
        failCount++;
        results.push(rowResult);
      }
    }
    
    res.json({
      success: true,
      message: '批量导入完成',
      results,
      summary: {
        total: items.length,
        success: successCount,
        failed: failCount,
        warnings: warningCount
      },
      consistency_warnings: consistencyWarnings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传CSV文件'
      });
    }
    
    const items = [];
    const filePath = req.file.path;
    
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => items.push(data))
        .on('end', resolve)
        .on('error', reject);
    });
    
    fs.unlinkSync(filePath);
    
    if (items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'CSV文件为空'
      });
    }
    
    req.body = { items };
    router.handle({ ...req, method: 'POST', url: '/batch' }, res, () => {});
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
