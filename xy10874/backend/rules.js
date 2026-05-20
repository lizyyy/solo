const db = require('./database');
const { v4: uuidv4 } = require('uuid');

const STABLE_PLATFORM_VERSIONS = ['3.0.0', '3.1.0', '3.2.0'];

function validateVersionFormat(version) {
  const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
  return semverRegex.test(version);
}

function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (parts1[i] > parts2[i]) return 1;
    if (parts1[i] < parts2[i]) return -1;
  }
  return 0;
}

function validateMaterial(pluginId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM screenshots WHERE plugin_id = ?', [pluginId], (err, screenshots) => {
      if (err) return reject(err);
      
      const errors = [];
      if (screenshots.length < 2) {
        errors.push({ rule: 'min_screenshots', message: '至少需要2张截图', level: 'ERROR' });
      }
      
      const invalidScreenshots = screenshots.filter(s => !s.is_valid);
      if (invalidScreenshots.length > 0) {
        errors.push({ rule: 'invalid_screenshots', message: `${invalidScreenshots.length}张截图未通过校验`, level: 'ERROR' });
      }
      
      resolve({ valid: errors.length === 0, errors, screenshots });
    });
  });
}

function validatePermissions(pluginId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM permissions WHERE plugin_id = ?', [pluginId], (err, permissions) => {
      if (err) return reject(err);
      
      const errors = [];
      const warnings = [];
      const highRiskPermissions = permissions.filter(p => p.risk_level === 'HIGH');
      
      if (highRiskPermissions.length > 0) {
        warnings.push({ 
          rule: 'high_risk_permissions', 
          message: `包含${highRiskPermissions.length}个高危权限，需要人工审核`,
          permissions: highRiskPermissions.map(p => p.permission_name),
          level: 'WARNING'
        });
      }
      
      if (permissions.length === 0) {
        errors.push({ rule: 'no_permissions', message: '未声明任何权限', level: 'ERROR' });
      }
      
      resolve({ 
        valid: errors.length === 0, 
        requiresManualReview: highRiskPermissions.length > 0,
        errors, 
        warnings,
        permissions 
      });
    });
  });
}

function validateVersionCompatibility(pluginId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT min_platform_version, max_platform_version FROM plugins WHERE id = ?', [pluginId], (err, plugin) => {
      if (err) return reject(err);
      
      const errors = [];
      const warnings = [];
      
      if (!validateVersionFormat(plugin.min_platform_version)) {
        errors.push({ rule: 'invalid_min_version', message: '最低平台版本格式不正确', level: 'ERROR' });
      }
      
      if (plugin.max_platform_version && !validateVersionFormat(plugin.max_platform_version)) {
        errors.push({ rule: 'invalid_max_version', message: '最高平台版本格式不正确', level: 'ERROR' });
      }
      
      const compatibleStableVersions = STABLE_PLATFORM_VERSIONS.filter(v => {
        const meetsMin = compareVersions(v, plugin.min_platform_version) >= 0;
        const meetsMax = !plugin.max_platform_version || compareVersions(v, plugin.max_platform_version) <= 0;
        return meetsMin && meetsMax;
      });
      
      if (compatibleStableVersions.length === 0) {
        errors.push({ rule: 'no_stable_compatibility', message: '未兼容任何稳定平台版本', level: 'ERROR' });
      } else {
        warnings.push({ 
          rule: 'compatible_versions', 
          message: `兼容${compatibleStableVersions.length}个稳定版本: ${compatibleStableVersions.join(', ')}`,
          level: 'INFO'
        });
      }
      
      resolve({ valid: errors.length === 0, errors, warnings, compatibleStableVersions });
    });
  });
}

const STATUS_TRANSITIONS = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['AUTO_AUDITING', 'REJECTED'],
  AUTO_AUDITING: ['PENDING_REVIEW', 'AUTO_PASSED', 'REJECTED'],
  PENDING_REVIEW: ['APPROVED', 'REJECTED'],
  AUTO_PASSED: ['APPROVED', 'REJECTED'],
  APPROVED: ['RELEASED', 'REJECTED'],
  RELEASED: ['ROLLED_BACK'],
  ROLLED_BACK: ['SUBMITTED'],
  REJECTED: ['SUBMITTED']
};

function canTransition(fromStatus, toStatus) {
  return STATUS_TRANSITIONS[fromStatus]?.includes(toStatus) || false;
}

async function transitionStatus(pluginId, toStatus, auditor, reason, suggestions) {
  return new Promise((resolve, reject) => {
    db.get('SELECT status FROM plugins WHERE id = ?', [pluginId], async (err, plugin) => {
      if (err) return reject(err);
      if (!plugin) return reject(new Error('插件不存在'));
      
      if (!canTransition(plugin.status, toStatus)) {
        return reject(new Error(`不允许从 ${plugin.status} 转换到 ${toStatus}`));
      }
      
      try {
        const validation = await runAllValidations(pluginId);
        
        if (toStatus === 'AUTO_PASSED' && (!validation.valid || validation.requiresManualReview)) {
          toStatus = 'PENDING_REVIEW';
        }
        
        db.run('UPDATE plugins SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [toStatus, pluginId], (err) => {
          if (err) return reject(err);
          
          const auditId = uuidv4();
          db.run(
            'INSERT INTO audit_records (id, plugin_id, auditor, status, reason, suggestions) VALUES (?, ?, ?, ?, ?, ?)',
            [auditId, pluginId, auditor, toStatus, reason, suggestions],
            (err) => {
              if (err) return reject(err);
              resolve({ success: true, newStatus: toStatus, auditId });
            }
          );
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}

async function runAllValidations(pluginId) {
  const [materialResult, permissionResult, compatibilityResult] = await Promise.all([
    validateMaterial(pluginId),
    validatePermissions(pluginId),
    validateVersionCompatibility(pluginId)
  ]);
  
  const allErrors = [...materialResult.errors, ...permissionResult.errors, ...compatibilityResult.errors];
  const allWarnings = [...permissionResult.warnings, ...compatibilityResult.warnings];
  
  return {
    valid: allErrors.length === 0,
    requiresManualReview: permissionResult.requiresManualReview,
    errors: allErrors,
    warnings: allWarnings,
    details: {
      material: materialResult,
      permissions: permissionResult,
      compatibility: compatibilityResult
    }
  };
}

function releasePlugin(pluginId, operator) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, version, status FROM plugins WHERE id = ?', [pluginId], (err, plugin) => {
      if (err) return reject(err);
      if (!plugin) return reject(new Error('插件不存在'));
      if (plugin.status !== 'APPROVED') return reject(new Error('只有审核通过的插件才能上架'));
      
      const releaseId = uuidv4();
      db.run(
        'INSERT INTO release_records (id, plugin_id, version, operator) VALUES (?, ?, ?, ?)',
        [releaseId, pluginId, plugin.version, operator],
        (err) => {
          if (err) return reject(err);
          
          db.run('UPDATE plugins SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['RELEASED', pluginId], (err) => {
            if (err) return reject(err);
            resolve({ success: true, releaseId });
          });
        }
      );
    });
  });
}

function rollbackPlugin(pluginId, operator, reason) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, status FROM plugins WHERE id = ?', [pluginId], (err, plugin) => {
      if (err) return reject(err);
      if (!plugin) return reject(new Error('插件不存在'));
      if (plugin.status !== 'RELEASED') return reject(new Error('只有已上架的插件才能回滚'));
      
      db.get('SELECT id FROM release_records WHERE plugin_id = ? AND is_rollback = 0 ORDER BY release_time DESC LIMIT 1', [pluginId], (err, release) => {
        if (err) return reject(err);
        if (!release) return reject(new Error('未找到上架记录'));
        
        db.run(
          'UPDATE release_records SET is_rollback = 1, rollback_time = CURRENT_TIMESTAMP, rollback_reason = ? WHERE id = ?',
          [reason, release.id],
          (err) => {
            if (err) return reject(err);
            
            db.run('UPDATE plugins SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['ROLLED_BACK', pluginId], (err) => {
              if (err) return reject(err);
              resolve({ success: true });
            });
          }
        );
      });
    });
  });
}

module.exports = {
  validateMaterial,
  validatePermissions,
  validateVersionCompatibility,
  runAllValidations,
  canTransition,
  transitionStatus,
  releasePlugin,
  rollbackPlugin,
  validateVersionFormat,
  compareVersions,
  STABLE_PLATFORM_VERSIONS
};
