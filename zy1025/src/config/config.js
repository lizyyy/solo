import fs from 'fs';
import path from 'path';
import { DEFAULT_CONFIG_FILE } from '../utils/constants.js';

export const DEFAULT_CONFIG = {
  optionalVars: [],
  localOnlyVars: [],
  excludedFiles: [
    'node_modules/**',
    '.git/**',
    'dist/**',
    'build/**',
  ],
  envFilePatterns: [
    '.env',
    '.env.example',
    '.env.local',
    '.env.development',
    '.env.production',
    '.env.test',
  ],
  scanMarkdown: true,
  scanDockerCompose: true,
  scanPackageJson: true,
  redactSecrets: true,
};

export function generateConfigTemplate() {
  return `{
  "optionalVars": [
    "// 标记为可选的环境变量，这些变量缺失不会被视为错误",
    "// 例如: \"DEBUG\", \"LOG_LEVEL\""
  ],
  "localOnlyVars": [
    "// 只在本地开发环境中使用的变量",
    "// 这些变量在 .env.local 中存在但 .env.example 中缺失不会被视为问题",
    "// 例如: \"NODE_ENV\", \"DEV_TOOLS\""
  ],
  "excludedFiles": [
    "// 要排除的文件/目录模式（支持 glob 风格）",
    "node_modules/**",
    ".git/**",
    "dist/**",
    "build/**"
  ],
  "envFilePatterns": [
    "// 要扫描的 env 文件模式",
    ".env",
    ".env.example",
    ".env.local",
    ".env.development",
    ".env.production",
    ".env.test"
  ],
  "scanMarkdown": true,
  "scanDockerCompose": true,
  "scanPackageJson": true,
  "redactSecrets": true
}`;
}

export function loadConfig(projectDir, configFile) {
  const configPath = configFile 
    ? path.resolve(configFile) 
    : path.join(projectDir, DEFAULT_CONFIG_FILE);

  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const rawContent = fs.readFileSync(configPath, 'utf-8');
    const userConfig = JSON.parse(rawContent);
    
    return {
      ...DEFAULT_CONFIG,
      ...userConfig,
      optionalVars: (userConfig.optionalVars || DEFAULT_CONFIG.optionalVars)
        .filter(v => !v.startsWith('//')),
      localOnlyVars: (userConfig.localOnlyVars || DEFAULT_CONFIG.localOnlyVars)
        .filter(v => !v.startsWith('//')),
      excludedFiles: (userConfig.excludedFiles || DEFAULT_CONFIG.excludedFiles)
        .filter(v => !v.startsWith('//')),
      envFilePatterns: (userConfig.envFilePatterns || DEFAULT_CONFIG.envFilePatterns)
        .filter(v => !v.startsWith('//')),
    };
  } catch (error) {
    throw new Error(`配置文件解析失败: ${configPath}\n${error.message}`);
  }
}

export function initConfig(targetPath) {
  const configPath = targetPath 
    ? path.resolve(targetPath) 
    : path.join(process.cwd(), DEFAULT_CONFIG_FILE);

  if (fs.existsSync(configPath)) {
    throw new Error(`配置文件已存在: ${configPath}`);
  }

  fs.writeFileSync(configPath, generateConfigTemplate(), 'utf-8');
  return configPath;
}
