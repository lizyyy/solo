import fs from 'fs/promises';
import path from 'path';
import { getRuleByField, getSignaturePosition } from './rules.js';

export async function compareVersions(inputPath, rules, logger) {
  logger.detail('开始扫描输入目录...');
  
  const contracts = await loadContracts(inputPath, logger);
  const results = [];

  for (const contract of contracts) {
    logger.detail(`处理合同: ${contract.contractNo} - ${contract.contractName}`);
    
    try {
      const result = await compareContract(contract, rules, logger);
      results.push(result);
    } catch (error) {
      logger.detail(`合同处理异常: ${error.message}`);
      results.push({
        contractNo: contract.contractNo,
        contractName: contract.contractName,
        contractType: contract.contractType,
        status: 'error',
        error: error.message,
      });
    }
  }

  return aggregateResults(results);
}

async function loadContracts(inputPath, logger) {
  const files = await fs.readdir(inputPath);
  const contractFiles = files.filter(f => f.endsWith('.json'));
  
  logger.detail(`找到 ${contractFiles.length} 个合同数据文件`);
  
  const contracts = [];
  for (const file of contractFiles) {
    const filePath = path.join(inputPath, file);
    const content = await fs.readFile(filePath, 'utf8');
    const contract = JSON.parse(content);
    contracts.push(contract);
  }
  
  return contracts;
}

async function compareContract(contract, rules, logger) {
  const { oldVersion, newVersion } = contract;
  
  if (!oldVersion || !newVersion) {
    throw new Error('缺少旧版本或新版本数据');
  }

  logger.detail(`比对合同: ${contract.contractNo}, 旧版本: ${oldVersion.version}, 新版本: ${newVersion.version}`);

  const differences = [];
  const missingAttachments = [];
  const signatureChanges = [];

  for (const rule of rules.comparisonRules) {
    const oldValue = getNestedValue(oldVersion, rule.field);
    const newValue = getNestedValue(newVersion, rule.field);
    
    logger.detail(`比对字段 ${rule.name}: ${oldValue} → ${newValue}`);
    
    if (oldValue !== newValue) {
      differences.push({
        field: rule.field,
        fieldName: rule.name,
        oldValue,
        newValue,
        severity: rule.severity || 'medium',
      });
      logger.detail(`发现差异: ${rule.name} 不匹配`);
    }
  }

  const oldAttachments = oldVersion.attachments || [];
  const newAttachments = newVersion.attachments || [];
  
  for (const required of rules.attachmentRules.required) {
    const oldHas = oldAttachments.some(a => a.name === required.name);
    const newHas = newAttachments.some(a => a.name === required.name);
    
    logger.detail(`检查附件 ${required.name}: 旧版${oldHas ? '有' : '无'}, 新版${newHas ? '有' : '无'}`);
    
    if (!newHas && required.required) {
      missingAttachments.push({
        name: required.name,
        description: required.description,
        severity: required.severity || 'high',
      });
      logger.detail(`发现附件漏传: ${required.name}`);
    }
  }

  const oldSignatures = oldVersion.signatures || [];
  const newSignatures = newVersion.signatures || [];
  
  for (const posRule of rules.signatureRules.positions) {
    const oldSig = oldSignatures.find(s => s.positionId === posRule.id);
    const newSig = newSignatures.find(s => s.positionId === posRule.id);
    
    if (oldSig && newSig) {
      logger.detail(`比对签章 ${posRule.name}: 旧版${oldSig.page}页, 新版${newSig.page}页`);
      
      if (oldSig.page !== newSig.page) {
        signatureChanges.push({
          positionId: posRule.id,
          positionName: posRule.name,
          oldPage: oldSig.page,
          newPage: newSig.page,
        });
        logger.detail(`发现签章位置变化: ${posRule.name}`);
      }
    }
  }

  let status = 'matched';
  if (missingAttachments.length > 0) {
    status = 'missing_attachment';
  } else if (signatureChanges.length > 0) {
    status = 'signature_change';
  } else if (differences.length > 0) {
    status = 'difference';
  }

  return {
    contractNo: contract.contractNo,
    contractName: contract.contractName,
    contractType: contract.contractType,
    oldVersion: oldVersion.version,
    newVersion: newVersion.version,
    status,
    differences,
    missingAttachments,
    signatureChanges,
  };
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

function aggregateResults(contracts) {
  const totalContracts = contracts.length;
  const matched = contracts.filter(c => c.status === 'matched').length;
  const differences = contracts.filter(c => c.status === 'difference').length;
  const missingAttachments = contracts.filter(c => c.status === 'missing_attachment').length;
  const signatureChanges = contracts.filter(c => c.status === 'signature_change').length;
  const errors = contracts.filter(c => c.status === 'error').length;

  return {
    totalContracts,
    matched,
    differences,
    missingAttachments,
    signatureChanges,
    errors,
    contracts,
    timestamp: new Date().toISOString(),
  };
}
