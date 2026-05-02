const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  rules: {
    'img-alt': { enabled: true, severity: 'error' },
    'form-label': { enabled: true, severity: 'error' },
    'button-text': { enabled: true, severity: 'error' },
    'link-text': { enabled: true, severity: 'error' },
    'duplicate-id': { enabled: true, severity: 'error' },
    'tabindex': { enabled: true, severity: 'warning' },
    'aria-misuse': { enabled: true, severity: 'error' },
    'color-contrast': { enabled: true, severity: 'warning' }
  },
  contrastThreshold: 4.5,
  ignorePatterns: [
    'node_modules/**',
    'dist/**',
    'build/**',
    '.git/**',
    '*.min.css',
    'vendor/**'
  ],
  fileExtensions: ['.html', '.jsx', '.tsx', '.css']
};

function findConfigFile(targetDir) {
  const possibleNames = [
    'a11y-smoke.config.json',
    '.a11y-smokerc.json'
  ];

  for (const name of possibleNames) {
    const configPath = path.join(targetDir, name);
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }

  const parentDir = path.dirname(targetDir);
  if (parentDir !== targetDir) {
    for (const name of possibleNames) {
      const configPath = path.join(parentDir, name);
      if (fs.existsSync(configPath)) {
        return configPath;
      }
    }
  }

  return null;
}

function loadConfig(targetDir, configPath) {
  let config = { ...DEFAULT_CONFIG };

  if (!configPath) {
    configPath = findConfigFile(targetDir);
  }

  if (configPath) {
    try {
      const rawConfig = fs.readFileSync(configPath, 'utf-8');
      const userConfig = JSON.parse(rawConfig);
      
      if (userConfig.rules) {
        for (const [ruleId, ruleConfig] of Object.entries(userConfig.rules)) {
          if (config.rules[ruleId]) {
            if (typeof ruleConfig === 'boolean') {
              config.rules[ruleId].enabled = ruleConfig;
            } else if (typeof ruleConfig === 'object') {
              config.rules[ruleId] = {
                ...config.rules[ruleId],
                ...ruleConfig
              };
            }
          }
        }
      }

      if (userConfig.contrastThreshold !== undefined) {
        config.contrastThreshold = userConfig.contrastThreshold;
      }

      if (userConfig.ignorePatterns) {
        config.ignorePatterns = [
          ...config.ignorePatterns,
          ...userConfig.ignorePatterns
        ];
      }

      if (userConfig.fileExtensions) {
        config.fileExtensions = userConfig.fileExtensions;
      }

      config.configPath = configPath;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`配置文件格式错误: ${configPath}\n${error.message}`);
      }
      throw new Error(`无法读取配置文件: ${configPath}\n${error.message}`);
    }
  }

  return config;
}

function shouldIgnore(filePath, config, baseDir) {
  const relativePath = path.relative(baseDir, filePath);
  const { minimatch } = require('minimatch');

  for (const pattern of config.ignorePatterns) {
    if (minimatch(relativePath, pattern) || minimatch(path.basename(filePath), pattern)) {
      return true;
    }
  }
  return false;
}

function isRuleEnabled(ruleId, config) {
  return config.rules[ruleId]?.enabled !== false;
}

function getRuleSeverity(ruleId, config) {
  return config.rules[ruleId]?.severity || 'warning';
}

module.exports = {
  DEFAULT_CONFIG,
  loadConfig,
  shouldIgnore,
  isRuleEnabled,
  getRuleSeverity
};
