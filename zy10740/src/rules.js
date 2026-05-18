const fs = require('fs-extra');
const path = require('path');

async function loadRules(rulesPath) {
  const content = await fs.readFile(rulesPath, 'utf-8');
  const rules = JSON.parse(content);
  
  validateRules(rules);
  return rules;
}

function validateRules(rules) {
  const requiredFields = ['fields', 'businessRules', 'outputConfig'];
  
  for (const field of requiredFields) {
    if (!rules[field]) {
      throw new Error(`规则配置缺少必需字段: ${field}`);
    }
  }

  if (!rules.fields.required || !Array.isArray(rules.fields.required)) {
    throw new Error('规则配置 fields.required 必须是数组');
  }
}

module.exports = {
  loadRules,
  validateRules
};
