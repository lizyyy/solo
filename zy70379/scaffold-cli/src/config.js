const path = require('path');
const fs = require('fs');

const RULE_DEFINITIONS = {
  'template-version': {
    id: 'template-version',
    name: '模板版本',
    description: '检查项目使用的模板版本是否为最新',
    severity: 'high',
    category: 'core',
    fixSuggestion: '升级项目到最新版本的标准模板'
  },
  'package-scripts': {
    id: 'package-scripts',
    name: 'Package 脚本',
    description: '检查 package.json 中的脚本是否与模板一致',
    severity: 'medium',
    category: 'build',
    fixSuggestion: '确保 start、build、test、lint、healthcheck 等脚本存在且配置正确'
  },
  'dockerfile': {
    id: 'dockerfile',
    name: 'Dockerfile',
    description: '检查 Dockerfile 配置是否符合标准（基础镜像、用户、工作目录、暴露端口等）',
    severity: 'high',
    category: 'deployment',
    fixSuggestion: '使用标准 Dockerfile，确保基础镜像、用户权限、健康检查配置正确'
  },
  'healthcheck': {
    id: 'healthcheck',
    name: '健康检查',
    description: '检查健康检查路径和配置是否符合标准',
    severity: 'critical',
    category: 'deployment',
    fixSuggestion: '确保存在 /health 端点，Dockerfile 中配置正确的 HEALTHCHECK'
  },
  'logging': {
    id: 'logging',
    name: '日志配置',
    description: '检查日志格式、级别和输出目标是否符合标准',
    severity: 'medium',
    category: 'observability',
    fixSuggestion: '使用 winston 等标准日志库，输出 JSON 格式到 stdout'
  },
  'directory-structure': {
    id: 'directory-structure',
    name: '目录结构',
    description: '检查项目目录结构是否符合标准',
    severity: 'low',
    category: 'structure',
    fixSuggestion: '遵循标准目录结构：src/controllers、src/services、tests 等'
  },
  'required-files': {
    id: 'required-files',
    name: '必需文件',
    description: '检查模板定义的必需文件是否存在',
    severity: 'high',
    category: 'structure',
    fixSuggestion: '添加缺失的必需文件'
  },
  'dependency-version': {
    id: 'dependency-version',
    name: '依赖版本',
    description: '检查依赖版本是否符合标准，是否存在过旧或过时的依赖',
    severity: 'medium',
    category: 'dependencies',
    fixSuggestion: '更新过期依赖到安全版本'
  },
  'node-version': {
    id: 'node-version',
    name: 'Node.js 版本',
    description: '检查 package.json 中 engines.node 的要求',
    severity: 'high',
    category: 'core',
    fixSuggestion: '升级 Node.js 版本要求到 >= 18.0.0'
  }
};

const SEVERITY_WEIGHTS = {
  critical: 100,
  high: 70,
  medium: 40,
  low: 10,
  info: 1
};

const DEFAULT_TEMPLATE = 'standard/v1.0.0';

function getRuleDefinitions() {
  return RULE_DEFINITIONS;
}

function getRuleDefinition(ruleId) {
  return RULE_DEFINITIONS[ruleId];
}

function getSeverityWeight(severity) {
  return SEVERITY_WEIGHTS[severity] || 1;
}

function calculateRiskScore(issues) {
  const score = issues.reduce((total, issue) => {
    return total + getSeverityWeight(issue.severity);
  }, 0);
  return score;
}

function getRiskLevel(score) {
  if (score >= 500) return { level: 'critical', label: '严重风险', color: 'red' };
  if (score >= 200) return { level: 'high', label: '高风险', color: 'red' };
  if (score >= 100) return { level: 'medium', label: '中风险', color: 'yellow' };
  if (score >= 50) return { level: 'low', label: '低风险', color: 'yellow' };
  return { level: 'none', label: '合规', color: 'green' };
}

module.exports = {
  RULE_DEFINITIONS,
  SEVERITY_WEIGHTS,
  DEFAULT_TEMPLATE,
  getRuleDefinitions,
  getRuleDefinition,
  getSeverityWeight,
  calculateRiskScore,
  getRiskLevel
};
