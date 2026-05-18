const PERMISSION_CATEGORIES = {
  OLD_TOKEN: '旧token残留权限',
  SUB_APP: '子应用残留权限',
  CACHE: '缓存残留权限'
};

function checkPermissionDowngrade(basePermissions, targetPermissions, options = {}) {
  const result = {
    toolName: '应用权限清单权限降级核验',
    version: '1.0.0',
    checkTime: new Date().toISOString(),
    summary: {
      totalResidue: 0,
      categories: {}
    },
    residue: [],
    details: {
      [PERMISSION_CATEGORIES.OLD_TOKEN]: [],
      [PERMISSION_CATEGORIES.SUB_APP]: [],
      [PERMISSION_CATEGORIES.CACHE]: []
    },
    metadata: {
      baseCount: 0,
      targetCount: 0,
      diffHint: '规则变更后，请对比历史报告结构变化可通过diff直接观察'
    }
  };

  const basePermMap = new Map();
  const targetPermMap = new Map();

  basePermissions.forEach(p => {
    basePermMap.set(p.id, p);
    result.metadata.baseCount++;
  });

  targetPermissions.forEach(p => {
    targetPermMap.set(p.id, p);
    result.metadata.targetCount++;
  });

  for (const permId of basePermMap.keys()) {
    const basePerm = basePermMap.get(permId);
    const targetPerm = targetPermMap.get(permId);

    if (targetPerm) {
      const residue = checkSinglePermission(basePerm, targetPerm);
      if (residue.hasResidue) {
        result.residue.push(residue);
        result.details[residue.category].push(residue);
        result.summary.totalResidue++;
        
        if (!result.summary.categories[residue.category]) {
          result.summary.categories[residue.category] = 0;
        }
        result.summary.categories[residue.category]++;
      }
    }
  }

  result.summary.checkResult = result.summary.totalResidue > 0 ? '发现残留权限' : '无残留权限';
  
  return result;
}

function checkSinglePermission(basePerm, targetPerm) {
  const result = {
    permissionId: basePerm.id,
    permissionName: basePerm.name,
    hasResidue: false,
    category: null,
    description: '',
    baseValue: null,
    targetValue: null,
    diff: []
  };

  if (basePerm.scope === 'old_token' || basePerm.type === 'token') {
    if (targetPerm.enabled === true || (targetPerm.level && compareLevel(basePerm.level, targetPerm.level) > 0)) {
      result.hasResidue = true;
      result.category = PERMISSION_CATEGORIES.OLD_TOKEN;
      result.description = '旧token权限未完全降级';
      result.baseValue = { enabled: basePerm.enabled, level: basePerm.level };
      result.targetValue = { enabled: targetPerm.enabled, level: targetPerm.level };
      result.diff = generateDiff(basePerm, targetPerm, ['enabled', 'level']);
    }
  }

  if (!result.hasResidue && (basePerm.scope === 'sub_app' || basePerm.type === 'subapp')) {
    if (targetPerm.inherited === true || (targetPerm.permissions && targetPerm.permissions.length > (basePerm.permissions?.length || 0))) {
      result.hasResidue = true;
      result.category = PERMISSION_CATEGORIES.SUB_APP;
      result.description = '子应用继承权限残留';
      result.baseValue = { inherited: basePerm.inherited, permCount: basePerm.permissions?.length || 0 };
      result.targetValue = { inherited: targetPerm.inherited, permCount: targetPerm.permissions?.length || 0 };
      result.diff = generateDiff(basePerm, targetPerm, ['inherited', 'permissions']);
    }
  }

  if (!result.hasResidue && (basePerm.scope === 'cache' || basePerm.type === 'cache')) {
    if (targetPerm.cached === true || (targetPerm.expireTime && targetPerm.expireTime > basePerm.expireTime)) {
      result.hasResidue = true;
      result.category = PERMISSION_CATEGORIES.CACHE;
      result.description = '缓存权限未过期或残留';
      result.baseValue = { cached: basePerm.cached, expireTime: basePerm.expireTime };
      result.targetValue = { cached: targetPerm.cached, expireTime: targetPerm.expireTime };
      result.diff = generateDiff(basePerm, targetPerm, ['cached', 'expireTime']);
    }
  }

  if (!result.hasResidue) {
    const levelDiff = compareLevel(basePerm.level, targetPerm.level);
    if (levelDiff > 0) {
      result.hasResidue = true;
      result.category = PERMISSION_CATEGORIES.OLD_TOKEN;
      result.description = '权限级别未降级';
      result.baseValue = { level: basePerm.level };
      result.targetValue = { level: targetPerm.level };
      result.diff = [{ field: 'level', oldValue: basePerm.level, newValue: targetPerm.level, type: 'level_not_downgraded' }];
    }
  }

  return result;
}

function generateDiff(base, target, fields) {
  const diffs = [];
  for (const field of fields) {
    const baseVal = base[field];
    const targetVal = target[field];
    
    diffs.push({
      field,
      oldValue: baseVal,
      newValue: targetVal,
      type: JSON.stringify(baseVal) !== JSON.stringify(targetVal) ? 'changed' : 'unchanged'
    });
  }
  return diffs;
}

function compareLevel(baseLevel, targetLevel) {
  const levelOrder = ['readonly', 'read', 'write', 'admin'];
  const baseIdx = levelOrder.indexOf(baseLevel);
  const targetIdx = levelOrder.indexOf(targetLevel);
  
  if (baseIdx === -1 || targetIdx === -1) return 0;
  return targetIdx - baseIdx;
}

function formatResult(result, format = 'json') {
  if (format === 'json') {
    return JSON.stringify(result, null, 2);
  }
  
  if (format === 'text') {
    let output = [];
    output.push('=' .repeat(60));
    output.push(`  ${result.toolName} 报告`);
    output.push('=' .repeat(60));
    output.push(`检查时间: ${new Date(result.checkTime).toLocaleString('zh-CN')}`);
    output.push(`检查结果: ${result.summary.checkResult}`);
    output.push(`残留总数: ${result.summary.totalResidue}`);
    output.push('');
    output.push('按类别统计:');
    for (const [category, count] of Object.entries(result.summary.categories)) {
      output.push(`  ${category}: ${count} 项`);
    }
    output.push('');
    
    if (result.residue.length > 0) {
      output.push('残留权限详情:');
      output.push('-'.repeat(60));
      for (const item of result.residue) {
        output.push(`【${item.category}】`);
        output.push(`  权限ID: ${item.permissionId}`);
        output.push(`  权限名称: ${item.permissionName}`);
        output.push(`  问题描述: ${item.description}`);
        output.push(`  差异明细:`);
        for (const d of item.diff) {
          output.push(`    ${d.field}: ${JSON.stringify(d.oldValue)} -> ${JSON.stringify(d.newValue)}`);
        }
        output.push('');
      }
    }
    
    output.push('-'.repeat(60));
    output.push(`提示: ${result.metadata.diffHint}`);
    return output.join('\n');
  }
  
  return result;
}

module.exports = {
  checkPermissionDowngrade,
  formatResult,
  PERMISSION_CATEGORIES
};
