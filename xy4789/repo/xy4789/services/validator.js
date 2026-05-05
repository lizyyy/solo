const db = require('../database/db');

// 验证单个藏品数据
function validateArtifact(artifact, index, allArtifacts, existingArtifacts = []) {
  const errors = [];
  const warnings = [];
  
  // 检查必填字段
  if (!artifact.artifactNumber || artifact.artifactNumber.trim() === '') {
    errors.push({
      type: 'error',
      field: 'artifactNumber',
      message: '藏品号不能为空'
    });
  }
  
  // 检查保险值是否为有效数字
  if (artifact.insuranceValue === null || artifact.insuranceValue === undefined || isNaN(artifact.insuranceValue)) {
    errors.push({
      type: 'error',
      field: 'insuranceValue',
      message: '保险值必须是有效数字'
    });
  }
  
  // 检查金额异常（保险值为0或负数）
  if (artifact.insuranceValue <= 0) {
    warnings.push({
      type: 'warning',
      field: 'insuranceValue',
      message: '保险值异常，当前值为0或负数'
    });
  }
  
  // 检查金额异常（保险值过大，超过1000万，可能是单位错误）
  if (artifact.insuranceValue > 10000000) {
    warnings.push({
      type: 'warning',
      field: 'insuranceValue',
      message: '保险值异常，超过1000万，请确认单位是否正确'
    });
  }
  
  // 检查缺证
  if (!artifact.hasCertificate) {
    warnings.push({
      type: 'warning',
      field: 'hasCertificate',
      message: '该藏品缺少相关证件'
    });
  }
  
  // 检查库位冲突（同一批次内）
  if (artifact.location && artifact.location.trim() !== '') {
    const sameLocationArtifacts = allArtifacts.filter((a, i) => 
      i !== index && 
      a.location === artifact.location && 
      a.status !== 'returned'
    );
    
    if (sameLocationArtifacts.length > 0) {
      warnings.push({
        type: 'warning',
        field: 'location',
        message: `库位冲突，藏品号 ${sameLocationArtifacts.map(a => a.artifactNumber).join(', ')} 已使用该库位`
      });
    }
  }
  
  return {
    errors: errors,
    warnings: warnings
  };
}

// 检查重复藏品号（同一批次内）
function checkDuplicateArtifacts(artifacts) {
  const artifactNumbers = {};
  const duplicates = [];
  
  artifacts.forEach((artifact, index) => {
    if (artifact.artifactNumber) {
      const key = artifact.artifactNumber.trim();
      
      if (artifactNumbers[key]) {
        // 添加到重复列表
        if (!duplicates.includes(artifactNumbers[key].index)) {
          duplicates.push(artifactNumbers[key].index);
        }
        duplicates.push(index);
        
        // 添加验证错误
        artifact.validationErrors = artifact.validationErrors || [];
        artifact.validationErrors.push({
          type: 'error',
          field: 'artifactNumber',
          message: `藏品号重复，与第 ${artifactNumbers[key].index + 1} 行重复`
        });
        
        // 也给之前的重复项添加错误
        const prevArtifact = artifacts[artifactNumbers[key].index];
        prevArtifact.validationErrors = prevArtifact.validationErrors || [];
        prevArtifact.validationErrors.push({
          type: 'error',
          field: 'artifactNumber',
          message: `藏品号重复，与第 ${index + 1} 行重复`
        });
      } else {
        artifactNumbers[key] = {
          index: index,
          artifact: artifact
        };
      }
    }
  });
  
  return duplicates;
}

// 检查与现有数据库中的藏品号冲突
async function checkExistingArtifacts(artifacts) {
  return new Promise((resolve, reject) => {
    const artifactNumbers = artifacts
      .filter(a => a.artifactNumber && a.artifactNumber.trim() !== '')
      .map(a => a.artifactNumber.trim());
    
    if (artifactNumbers.length === 0) {
      resolve([]);
      return;
    }
    
    const placeholders = artifactNumbers.map(() => '?').join(',');
    const query = `
      SELECT artifact_number, id, batch_id, status
      FROM artifacts
      WHERE artifact_number IN (${placeholders}) AND status = 'confirmed'
    `;
    
    db.all(query, artifactNumbers, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      const existingMap = {};
      rows.forEach(row => {
        existingMap[row.artifact_number] = row;
      });
      
      // 为冲突的藏品添加验证错误
      artifacts.forEach((artifact, index) => {
        if (artifact.artifactNumber) {
          const key = artifact.artifactNumber.trim();
          
          if (existingMap[key]) {
            artifact.validationErrors = artifact.validationErrors || [];
            artifact.validationErrors.push({
              type: 'warning',
              field: 'artifactNumber',
              message: `藏品号已存在于数据库中（批次ID: ${existingMap[key].batch_id}）`
            });
          }
        }
      });
      
      resolve(rows);
    });
  });
}

// 验证整个批次的藏品数据
async function validateArtifacts(artifacts) {
  const results = {
    total: artifacts.length,
    valid: 0,
    hasErrors: false,
    hasWarnings: false,
    summary: {
      errors: [],
      warnings: [],
      duplicates: [],
      missingCertificates: 0,
      locationConflicts: 0,
      valueAnomalies: 0
    }
  };
  
  // 初始化每个藏品的验证错误数组
  artifacts.forEach(artifact => {
    artifact.validationErrors = [];
  });
  
  // 检查重复藏品号（同一批次内）
  const duplicates = checkDuplicateArtifacts(artifacts);
  results.summary.duplicates = duplicates;
  
  if (duplicates.length > 0) {
    results.hasErrors = true;
    results.summary.errors.push({
      type: 'duplicate',
      message: `发现 ${duplicates.length} 个重复藏品号`
    });
  }
  
  // 检查与现有数据库中的藏品号冲突
  try {
    await checkExistingArtifacts(artifacts);
  } catch (error) {
    console.error('检查现有藏品时出错:', error);
  }
  
  // 验证每个藏品
  artifacts.forEach((artifact, index) => {
    const validation = validateArtifact(artifact, index, artifacts);
    
    // 合并验证结果
    artifact.validationErrors = [
      ...(artifact.validationErrors || []),
      ...validation.errors,
      ...validation.warnings
    ];
    
    // 统计
    if (validation.errors.length > 0) {
      results.hasErrors = true;
      validation.errors.forEach(err => {
        if (err.field === 'insuranceValue' && (err.message.includes('0') || err.message.includes('负数') || err.message.includes('超过'))) {
          results.summary.valueAnomalies++;
        }
      });
    }
    
    if (validation.warnings.length > 0) {
      results.hasWarnings = true;
      validation.warnings.forEach(warn => {
        if (warn.field === 'hasCertificate') {
          results.summary.missingCertificates++;
        }
        if (warn.field === 'location') {
          results.summary.locationConflicts++;
        }
        if (warn.field === 'insuranceValue') {
          results.summary.valueAnomalies++;
        }
      });
    }
    
    // 如果没有错误，计数为有效
    if (validation.errors.length === 0) {
      results.valid++;
    }
  });
  
  // 生成汇总信息
  if (results.summary.missingCertificates > 0) {
    results.summary.warnings.push({
      type: 'missing_certificate',
      message: `发现 ${results.summary.missingCertificates} 个藏品缺少证件`
    });
  }
  
  if (results.summary.locationConflicts > 0) {
    results.summary.warnings.push({
      type: 'location_conflict',
      message: `发现 ${results.summary.locationConflicts} 个库位冲突`
    });
  }
  
  if (results.summary.valueAnomalies > 0) {
    results.summary.warnings.push({
      type: 'value_anomaly',
      message: `发现 ${results.summary.valueAnomalies} 个保险值异常`
    });
  }
  
  return results;
}

module.exports = {
  validateArtifact,
  validateArtifacts,
  checkDuplicateArtifacts,
  checkExistingArtifacts
};
