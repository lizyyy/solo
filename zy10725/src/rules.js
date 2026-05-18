import yaml from 'js-yaml';
import fs from 'fs/promises';

export async function loadRules(rulesPath) {
  try {
    const content = await fs.readFile(rulesPath, 'utf8');
    return yaml.load(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`规则文件不存在: ${rulesPath}`);
    }
    throw new Error(`规则文件解析失败: ${error.message}`);
  }
}

export function validateRules(rules) {
  if (!rules || typeof rules !== 'object') {
    throw new Error('规则配置必须是一个对象');
  }

  if (!rules.version) {
    throw new Error('规则配置缺少 version 字段');
  }

  if (!rules.contractTypes || !Array.isArray(rules.contractTypes)) {
    throw new Error('规则配置缺少 contractTypes 数组');
  }

  if (!rules.comparisonRules || !Array.isArray(rules.comparisonRules)) {
    throw new Error('规则配置缺少 comparisonRules 数组');
  }

  if (!rules.attachmentRules) {
    throw new Error('规则配置缺少 attachmentRules');
  }

  if (!rules.signatureRules) {
    throw new Error('规则配置缺少 signatureRules');
  }

  rules.contractTypes.forEach((type, index) => {
    if (!type.id || !type.name) {
      throw new Error(`contractTypes[${index}] 缺少 id 或 name 字段`);
    }
  });

  rules.comparisonRules.forEach((rule, index) => {
    if (!rule.field || !rule.name) {
      throw new Error(`comparisonRules[${index}] 缺少 field 或 name 字段`);
    }
  });

  if (!rules.attachmentRules.required || !Array.isArray(rules.attachmentRules.required)) {
    throw new Error('attachmentRules.required 必须是数组');
  }

  if (!rules.signatureRules.positions || !Array.isArray(rules.signatureRules.positions)) {
    throw new Error('signatureRules.positions 必须是数组');
  }

  rules.signatureRules.positions.forEach((pos, index) => {
    if (!pos.id || !pos.name) {
      throw new Error(`signatureRules.positions[${index}] 缺少 id 或 name 字段`);
    }
  });
}

export function getRuleByField(rules, field) {
  return rules.comparisonRules.find(r => r.field === field);
}

export function getAttachmentRule(rules, attachmentName) {
  return rules.attachmentRules.required.find(r => r.name === attachmentName);
}

export function getSignaturePosition(rules, positionId) {
  return rules.signatureRules.positions.find(p => p.id === positionId);
}
