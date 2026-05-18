const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

function detectEyeSwap(record, rules) {
  const warnings = [];
  
  const leftSphere = parseFloat(record['左眼球镜'] || record['L_SPH'] || 0);
  const rightSphere = parseFloat(record['右眼球镜'] || record['R_SPH'] || 0);
  const leftCylinder = parseFloat(record['左眼柱镜'] || record['L_CYL'] || 0);
  const rightCylinder = parseFloat(record['右眼柱镜'] || record['R_CYL'] || 0);
  
  if (rules.eyeSwap && rules.eyeSwap.enabled) {
    const threshold = rules.eyeSwap.threshold || 2.0;
    const leftDiff = Math.abs(leftSphere - rightSphere);
    const rightDiff = Math.abs(leftCylinder - rightCylinder);
    
    if (leftDiff > threshold || rightDiff > threshold) {
      warnings.push({
        type: 'EYE_SWAP',
        message: '检测到可能的左右眼参数颠倒',
        details: `左眼球镜: ${leftSphere}, 右眼球镜: ${rightSphere}, 差值: ${leftDiff.toFixed(2)}`
      });
    }
  }
  
  return warnings;
}

function validateAxisRange(record, rules) {
  const warnings = [];
  
  const leftAxis = parseInt(record['左眼轴位'] || record['L_AXIS'] || 0);
  const rightAxis = parseInt(record['右眼轴位'] || record['R_AXIS'] || 0);
  
  if (rules.axisRange && rules.axisRange.enabled) {
    const min = rules.axisRange.min || 0;
    const max = rules.axisRange.max || 180;
    
    if (leftAxis < min || leftAxis > max) {
      warnings.push({
        type: 'AXIS_RANGE',
        message: '左眼轴位超出有效范围',
        details: `轴位: ${leftAxis}, 有效范围: ${min}-${max}`
      });
    }
    
    if (rightAxis < min || rightAxis > max) {
      warnings.push({
        type: 'AXIS_RANGE',
        message: '右眼轴位超出有效范围',
        details: `轴位: ${rightAxis}, 有效范围: ${min}-${max}`
      });
    }
  }
  
  return warnings;
}

function validateRequiredFields(record, rules) {
  const errors = [];
  
  if (rules.requiredFields) {
    for (const field of rules.requiredFields) {
      if (!record[field] || record[field].toString().trim() === '') {
        errors.push({
          type: 'MISSING_FIELD',
          message: `缺少必填字段: ${field}`,
          field: field
        });
      }
    }
  }
  
  return errors;
}

function detectReprocessed(record, rules) {
  const warnings = [];
  
  if (rules.reprocess && rules.reprocess.enabled) {
    const reprocessFlag = record['重跑标记'] || record['REPROCESSED'] || '';
    if (reprocessFlag === 'Y' || reprocessFlag === '是' || reprocessFlag === '1') {
      warnings.push({
        type: 'REPROCESSED',
        message: '该记录为重跑数据',
        details: `原始单号: ${record['原始单号'] || record['ORIGINAL_ID'] || 'N/A'}`
      });
    }
  }
  
  return warnings;
}

async function readCSVFile(filePath) {
  const records = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => records.push(data))
      .on('end', () => resolve(records))
      .on('error', reject);
  });
}

async function validateLensData(inputDir, rules, verbose) {
  const results = [];
  const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.csv'));
  
  for (const file of files) {
    const filePath = path.join(inputDir, file);
    const records = await readCSVFile(filePath);
    
    if (verbose) {
      console.log(`处理文件: ${file}, 记录数: ${records.length}`);
    }
    
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const warnings = [
        ...detectEyeSwap(record, rules),
        ...validateAxisRange(record, rules),
        ...detectReprocessed(record, rules)
      ];
      
      const errors = validateRequiredFields(record, rules);
      
      results.push({
        sourceFile: file,
        recordIndex: i,
        prescriptionId: record['处方单号'] || record['ID'] || `${file}-${i}`,
        patientName: record['患者姓名'] || record['NAME'] || 'N/A',
        record: { ...record },
        warnings: warnings.length > 0 ? warnings : undefined,
        errors: errors.length > 0 ? errors : undefined,
        status: errors.length > 0 ? 'ERROR' : warnings.length > 0 ? 'WARNING' : 'PASS'
      });
    }
  }
  
  return results;
}

module.exports = {
  validateLensData
};
