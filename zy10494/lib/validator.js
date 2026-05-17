const { getScanGateLevel, getSeverityLevel } = require('./cli-config');

function validateAllRecords(data, recordsWithSource, options) {
  const fromEnv = options.fromEnv;
  const toEnv = options.toEnv;
  const strictMode = options.strict || false;

  const groupedByTag = groupRecordsByImageTag(data, recordsWithSource);

  const results = [];

  for (const [imageTag, tagRecords] of Object.entries(groupedByTag)) {
    const validation = validateImageTag(imageTag, tagRecords, fromEnv, toEnv, options);
    results.push(validation);
  }

  return results;
}

function groupRecordsByImageTag(data, recordsWithSource) {
  const grouped = {};
  
  data.forEach((record, idx) => {
    const tag = record.imageTag;
    if (!grouped[tag]) {
      grouped[tag] = [];
    }
    grouped[tag].push({
      record,
      source: recordsWithSource[idx]?.source || null
    });
  });

  return grouped;
}

function validateImageTag(imageTag, tagRecords, fromEnv, toEnv, options) {
  const issues = [];
  const missingItems = [];
  let status = 'pass';

  const fromRecords = tagRecords.filter(r => r.record.environment === fromEnv);
  const toRecords = tagRecords.filter(r => r.record.environment === toEnv);

  const fromRecord = fromRecords.length > 0 ? fromRecords[0] : null;
  const toRecord = toRecords.length > 0 ? toRecords[0] : null;

  const stageComparison = compareStages(fromRecord, toRecord, fromEnv, toEnv);

  const signatureCheck = checkSignature(fromRecord, toRecord, fromEnv, toEnv, options.strict);

  const scanCheck = checkScanGate(fromRecord, toRecord, options);

  const deploymentCheck = checkDeploymentRecord(fromRecord, toRecord, fromEnv, toEnv, options.strict);

  if (!fromRecord) {
    missingItems.push({ field: 'sourceEnvRecord', message: `源环境 ${fromEnv} 无记录`, source: null });
    if (options.strict) status = 'fail';
  }

  if (!toRecord) {
    missingItems.push({ field: 'targetEnvRecord', message: `目标环境 ${toEnv} 无记录`, source: null });
  }

  if (!signatureCheck.passed) {
    status = 'fail';
    signatureCheck.issues.forEach(i => issues.push(i));
  }

  if (!scanCheck.passed) {
    status = 'fail';
    scanCheck.issues.forEach(i => issues.push(i));
  }

  if (!deploymentCheck.passed) {
    status = 'fail';
    deploymentCheck.issues.forEach(i => issues.push(i));
  }

  if (!stageComparison.consistent && options.strict) {
    status = 'fail';
    issues.push({
      type: 'stage_inconsistency',
      message: stageComparison.message,
      source: null
    });
  }

  return {
    imageTag,
    status,
    fromEnv,
    toEnv,
    stageComparison,
    signatureCheck,
    scanCheck,
    deploymentCheck,
    issues,
    missingItems,
    sourceRecords: {
      from: fromRecord?.source || null,
      to: toRecord?.source || null,
      all: tagRecords.map(r => r.source)
    },
    rawData: {
      from: fromRecord?.record || null,
      to: toRecord?.record || null
    }
  };
}

function compareStages(fromRecord, toRecord, fromEnv, toEnv) {
  if (!fromRecord || !toRecord) {
    return {
      consistent: false,
      message: !fromRecord ? `缺少源环境 ${fromEnv} 记录` : `缺少目标环境 ${toEnv} 记录`,
      details: null
    };
  }

  const fromTime = fromRecord.record.promotion?.promotionTime || fromRecord.record.deployment?.deployedAt;
  const toTime = toRecord.record.promotion?.promotionTime || toRecord.record.deployment?.deployedAt;

  return {
    consistent: true,
    message: `环境阶段 ${fromEnv} → ${toEnv} 比对完成`,
    details: {
      fromEnv,
      toEnv,
      fromTime,
      toTime
    }
  };
}

function checkSignature(fromRecord, toRecord, fromEnv, toEnv, strictMode) {
  const issues = [];
  const details = {};

  if (fromRecord) {
    details.fromSigned = fromRecord.record.signature?.signed || false;
    details.fromSigner = fromRecord.record.signature?.signer || '';
    details.fromFingerprint = fromRecord.record.signature?.fingerprint || '';
    
    if (!details.fromSigned && strictMode) {
      issues.push({
        type: 'signature_missing',
        message: `源环境 ${fromEnv} 镜像未签名`,
        source: fromRecord.source
      });
    } else if (!details.fromSigned) {
      issues.push({
        type: 'signature_warning',
        message: `警告: 源环境 ${fromEnv} 镜像未签名`,
        severity: 'warning',
        source: fromRecord.source
      });
    }
  }

  if (toRecord) {
    details.toSigned = toRecord.record.signature?.signed || false;
    details.toSigner = toRecord.record.signature?.signer || '';
    details.toFingerprint = toRecord.record.signature?.fingerprint || '';
    
    if (!details.toSigned) {
      issues.push({
        type: 'signature_missing',
        message: `目标环境 ${toEnv} 镜像未签名 - 必须签名才能晋级`,
        source: toRecord.source
      });
    }
  }

  if (fromRecord && toRecord && details.fromSigned && details.toSigned) {
    if (details.fromFingerprint && details.toFingerprint && details.fromFingerprint !== details.toFingerprint) {
      issues.push({
        type: 'signature_mismatch',
        message: `签名指纹不匹配: 源环境=${details.fromFingerprint}, 目标环境=${details.toFingerprint}`,
        source: { from: fromRecord.source, to: toRecord.source }
      });
    }
  }

  const criticalIssues = issues.filter(i => i.severity !== 'warning');
  const passed = criticalIssues.length === 0;

  return {
    passed,
    issues,
    details
  };
}

function checkScanGate(fromRecord, toRecord, options) {
  const issues = [];
  const gateLevel = getScanGateLevel(options.scanGate);
  const details = {};

  const scanSource = toRecord || fromRecord;
  if (!scanSource) {
    return {
      passed: !options.strict,
      issues: options.strict ? [{
        type: 'scan_missing',
        message: '无法检查扫描结果：两个环境都没有记录',
        source: null
      }] : [],
      details: { scanned: false }
    };
  }

  const scan = scanSource.record.scan;
  details.scanned = scan?.scanned || false;
  details.criticalCount = scan?.criticalCount || 0;
  details.highCount = scan?.highCount || 0;
  details.mediumCount = scan?.mediumCount || 0;
  details.lowCount = scan?.lowCount || 0;
  details.scanGate = options.scanGate;

  if (!details.scanned) {
    issues.push({
      type: 'scan_missing',
      message: '镜像未进行安全扫描',
      source: scanSource.source
    });
    return { passed: false, issues, details };
  }

  if (details.criticalCount > 0 && gateLevel <= getSeverityLevel('critical')) {
    issues.push({
      type: 'scan_violation',
      message: `发现 ${details.criticalCount} 个 Critical 级漏洞，超过门禁阈值`,
      severity: 'critical',
      source: scanSource.source
    });
  }

  if (details.highCount > 0 && gateLevel <= getSeverityLevel('high')) {
    issues.push({
      type: 'scan_violation',
      message: `发现 ${details.highCount} 个 High 级漏洞，超过门禁阈值`,
      severity: 'high',
      source: scanSource.source
    });
  }

  if (details.mediumCount > 0 && gateLevel <= getSeverityLevel('medium')) {
    issues.push({
      type: 'scan_violation',
      message: `发现 ${details.mediumCount} 个 Medium 级漏洞，超过门禁阈值`,
      severity: 'medium',
      source: scanSource.source
    });
  }

  return {
    passed: issues.length === 0,
    issues,
    details
  };
}

function checkDeploymentRecord(fromRecord, toRecord, fromEnv, toEnv, strictMode) {
  const issues = [];
  const details = {};

  if (fromRecord) {
    details.fromDeployed = fromRecord.record.deployment?.deployed || false;
    details.fromDeployedAt = fromRecord.record.deployment?.deployedAt || '';
    details.fromCluster = fromRecord.record.deployment?.cluster || '';
    
    if (!details.fromDeployed && strictMode) {
      issues.push({
        type: 'deployment_missing',
        message: `源环境 ${fromEnv} 无部署记录`,
        source: fromRecord.source
      });
    }
  }

  if (toRecord) {
    details.toDeployed = toRecord.record.deployment?.deployed || false;
    details.toDeployedAt = toRecord.record.deployment?.deployedAt || '';
    details.toCluster = toRecord.record.deployment?.cluster || '';
    
    if (!details.toDeployed && strictMode) {
      issues.push({
        type: 'deployment_missing',
        message: `目标环境 ${toEnv} 无部署记录`,
        source: toRecord.source
      });
    }
  }

  if (fromRecord && details.fromDeployed && toRecord && !details.toDeployed) {
    issues.push({
      type: 'deployment_mismatch',
      message: `源环境 ${fromEnv} 已部署，但目标环境 ${toEnv} 无部署记录`,
      source: { from: fromRecord.source, to: toRecord.source }
    });
  }

  return {
    passed: issues.length === 0,
    issues,
    details
  };
}

module.exports = {
  validateAllRecords
};
