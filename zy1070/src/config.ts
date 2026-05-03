import { cosmiconfigSync } from 'cosmiconfig';
import * as path from 'path';
import * as fs from 'fs';
import { Config } from './types';

export const DEFAULT_CONFIG: Partial<Config> = {
  tokenFiles: ['tokens.json', 'tokens.yaml', 'tokens.yml'],
  sourceDirs: ['src'],
  ignorePatterns: [
    'node_modules/**',
    'dist/**',
    'build/**',
    '.git/**',
    '**/*.test.{ts,tsx,js,jsx}',
    '**/*.spec.{ts,tsx,js,jsx}',
  ],
  allowedHardcoded: ['transparent', 'inherit', 'currentColor', 'initial', 'unset'],
  themeNames: ['light', 'dark'],
  outputDir: './token-drift-report',
};

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export function loadConfig(cwd: string = process.cwd()): Config {
  const explorer = cosmiconfigSync('token-drift', {
    searchPlaces: [
      'token-drift.config.json',
      'token-drift.config.js',
      'token-drift.config.ts',
      '.token-driftrc',
      '.token-driftrc.json',
      '.token-driftrc.js',
      'package.json',
    ],
    packageProp: 'tokenDrift',
  });

  const result = explorer.search(cwd);

  if (!result) {
    return {
      projectRoot: cwd,
      ...DEFAULT_CONFIG,
    } as Config;
  }

  const rawConfig = result.config;
  const configPath = path.dirname(result.filepath);

  return validateAndNormalizeConfig(rawConfig, configPath);
}

function validateAndNormalizeConfig(rawConfig: any, configPath: string): Config {
  const config: Config = {
    projectRoot: configPath,
    tokenFiles: rawConfig.tokenFiles || DEFAULT_CONFIG.tokenFiles!,
    sourceDirs: rawConfig.sourceDirs || DEFAULT_CONFIG.sourceDirs!,
    ignorePatterns: [
      ...DEFAULT_CONFIG.ignorePatterns!,
      ...(rawConfig.ignorePatterns || []),
    ],
    allowedHardcoded: [
      ...DEFAULT_CONFIG.allowedHardcoded!,
      ...(rawConfig.allowedHardcoded || []),
    ],
    themeNames: rawConfig.themeNames || DEFAULT_CONFIG.themeNames!,
    outputDir: rawConfig.outputDir || DEFAULT_CONFIG.outputDir!,
  };

  validateConfig(config);

  return config;
}

function validateConfig(config: Config): void {
  if (!config.projectRoot || !fs.existsSync(config.projectRoot)) {
    throw new ConfigError(`项目根目录不存在: ${config.projectRoot}`);
  }

  if (!Array.isArray(config.sourceDirs) || config.sourceDirs.length === 0) {
    throw new ConfigError('sourceDirs 必须是非空数组');
  }

  for (const dir of config.sourceDirs) {
    const fullPath = path.resolve(config.projectRoot, dir);
    if (!fs.existsSync(fullPath)) {
      throw new ConfigError(`源码目录不存在: ${dir} (完整路径: ${fullPath})`);
    }
  }

  if (!Array.isArray(config.ignorePatterns)) {
    throw new ConfigError('ignorePatterns 必须是数组');
  }

  if (!Array.isArray(config.allowedHardcoded)) {
    throw new ConfigError('allowedHardcoded 必须是数组');
  }

  if (!Array.isArray(config.themeNames) || config.themeNames.length === 0) {
    throw new ConfigError('themeNames 必须是非空数组');
  }
}

export function createInitConfig(projectRoot: string): Config {
  return {
    projectRoot,
    tokenFiles: ['design-tokens/tokens.json'],
    sourceDirs: ['src'],
    ignorePatterns: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.git/**',
      '**/*.test.{ts,tsx,js,jsx}',
    ],
    allowedHardcoded: ['transparent', 'inherit', 'currentColor'],
    themeNames: ['light', 'dark'],
    outputDir: './token-drift-report',
  };
}
