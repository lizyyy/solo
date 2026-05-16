import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_CONFIG = {
  packages: ['packages/*', 'apps/*'],
  rules: {},
  ignore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
  ],
  extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs'],
  output: {
    dir: './monobound-reports',
    formats: ['terminal', 'json', 'html'],
  },
};

export async function loadConfig(configPath) {
  const possiblePaths = configPath
    ? [configPath]
    : [
        '.monoboundrc.json',
        '.monoboundrc.js',
        'monobound.config.json',
        'monobound.config.js',
      ];

  for (const p of possiblePaths) {
    try {
      const fullPath = path.resolve(process.cwd(), p);
      const stat = await fs.stat(fullPath);
      if (stat.isFile()) {
        if (p.endsWith('.json')) {
          const content = await fs.readFile(fullPath, 'utf-8');
          return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
        } else if (p.endsWith('.js')) {
          const configModule = await import(fullPath);
          return { ...DEFAULT_CONFIG, ...configModule.default };
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw new Error(`Failed to load config from ${p}: ${err.message}`);
      }
    }
  }

  return DEFAULT_CONFIG;
}

export function validateConfig(config) {
  const errors = [];

  if (!config.packages || !Array.isArray(config.packages) || config.packages.length === 0) {
    errors.push('配置必须包含非空的 packages 数组');
  }

  if (!config.rules || typeof config.rules !== 'object') {
    errors.push('配置必须包含 rules 对象');
  }

  if (!config.extensions || !Array.isArray(config.extensions) || config.extensions.length === 0) {
    errors.push('配置必须包含非空的 extensions 数组');
  }

  return { valid: errors.length === 0, errors };
}
