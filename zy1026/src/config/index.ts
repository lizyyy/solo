import * as fs from 'fs';
import * as path from 'path';
import { Config } from '../types';

const DEFAULT_CONFIG: Config = {
  docsDir: './docs',
  ignorePatterns: ['node_modules/**', '.git/**'],
  ignoreUrls: [],
  external: {
    enabled: true,
    concurrency: 5,
    timeout: 10000,
    retries: 2,
    retryDelay: 1000,
    cacheDir: './.docguard/cache',
    cacheTTL: 24 * 60 * 60 * 1000,
    userAgent: 'docguard/1.0.0'
  },
  images: {
    enabled: true,
    checkMtime: true,
    checkHash: false
  },
  anchors: {
    enabled: true,
    caseSensitive: false,
    allowDuplicates: false
  },
  severity: {
    missingImage: 'error',
    expiredImage: 'warning',
    missingLink: 'error',
    invalidAnchor: 'error',
    duplicateAnchor: 'warning',
    failedExternal: 'error'
  },
  output: {
    terminal: true,
    markdown: false,
    markdownPath: './docguard-report.md',
    html: false,
    htmlPath: './docguard-report.html',
    json: true,
    jsonPath: './docguard-results.json'
  }
};

export class ConfigManager {
  private configPath: string;
  private config: Config;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'docguard.config.json');
    this.config = { ...DEFAULT_CONFIG };
    this.loadConfig();
  }

  private loadConfig(): void {
    if (fs.existsSync(this.configPath)) {
      try {
        const fileContent = fs.readFileSync(this.configPath, 'utf-8');
        const userConfig = JSON.parse(fileContent);
        this.config = this.mergeConfig(this.config, userConfig);
      } catch (error) {
        console.warn(`警告: 无法加载配置文件 ${this.configPath}: ${(error as Error).message}`);
      }
    }
  }

  private mergeConfig(defaults: Config, userConfig: Partial<Config>): Config {
    const merged = { ...defaults };

    if (userConfig.docsDir !== undefined) merged.docsDir = userConfig.docsDir;
    if (userConfig.ignorePatterns !== undefined) merged.ignorePatterns = userConfig.ignorePatterns;
    if (userConfig.ignoreUrls !== undefined) merged.ignoreUrls = userConfig.ignoreUrls;

    if (userConfig.external) {
      merged.external = { ...merged.external, ...userConfig.external };
    }

    if (userConfig.images) {
      merged.images = { ...merged.images, ...userConfig.images };
    }

    if (userConfig.anchors) {
      merged.anchors = { ...merged.anchors, ...userConfig.anchors };
    }

    if (userConfig.severity) {
      merged.severity = { ...merged.severity, ...userConfig.severity };
    }

    if (userConfig.output) {
      merged.output = { ...merged.output, ...userConfig.output };
    }

    return merged;
  }

  getConfig(): Config {
    return this.config;
  }

  updateConfig(updates: Partial<Config>): void {
    this.config = this.mergeConfig(this.config, updates);
  }

  saveConfig(): void {
    try {
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error(`无法保存配置文件: ${(error as Error).message}`);
    }
  }

  static getDefaultConfig(): Config {
    return { ...DEFAULT_CONFIG };
  }

  static initConfig(configPath: string): void {
    if (fs.existsSync(configPath)) {
      console.log(`配置文件已存在: ${configPath}`);
      return;
    }

    const parentDir = path.dirname(configPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(
      configPath,
      JSON.stringify(DEFAULT_CONFIG, null, 2),
      'utf-8'
    );
    console.log(`已创建配置文件: ${configPath}`);
  }
}
