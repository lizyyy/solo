import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { Config, CliOptions } from './types';

const DEFAULT_CONFIG: Config = {
  serviceDirectories: ['services.yaml', 'services.json', '*.yaml', '*.json'],
  alertRulePaths: ['alerts/**/*.yaml', 'alerts/**/*.yml'],
  repoProbe: {
    enabled: true,
    timeout: 10000,
    githubApiBase: 'https://api.github.com'
  },
  orphanCriteria: {
    repoArchived: true,
    noCommitSinceDays: 180,
    noAlertReferences: true,
    inactiveStatus: true
  },
  output: {
    formats: ['json', 'markdown', 'csv'],
    timestampPrefix: false
  }
};

export class ConfigManager {
  private config: Config;
  private cliOptions: CliOptions;

  constructor(cliOptions: CliOptions) {
    this.cliOptions = cliOptions;
    this.config = this.loadConfig();
    this.mergeCliOptions();
  }

  private loadConfig(): Config {
    if (!this.cliOptions.configFile) {
      return { ...DEFAULT_CONFIG };
    }

    const ext = path.extname(this.cliOptions.configFile).toLowerCase();
    const content = fs.readFileSync(this.cliOptions.configFile, 'utf-8');

    try {
      let loadedConfig: Partial<Config>;
      
      if (ext === '.yaml' || ext === '.yml') {
        loadedConfig = yaml.load(content) as Partial<Config>;
      } else if (ext === '.json') {
        loadedConfig = JSON.parse(content);
      } else {
        throw new Error(`不支持的配置文件格式: ${ext}`);
      }

      return this.deepMerge(DEFAULT_CONFIG, loadedConfig);
    } catch (e: any) {
      throw new Error(`配置文件解析失败: ${e.message}`);
    }
  }

  private deepMerge(base: Config, override: Partial<Config>): Config {
    const result = { ...base };
    
    for (const key of Object.keys(override)) {
      const baseValue = (result as any)[key];
      const overrideValue = (override as any)[key];
      
      if (this.isObject(baseValue) && this.isObject(overrideValue)) {
        (result as any)[key] = this.deepMerge(baseValue, overrideValue);
      } else if (overrideValue !== undefined) {
        (result as any)[key] = overrideValue;
      }
    }
    
    return result;
  }

  private isObject(obj: any): boolean {
    return obj !== null && typeof obj === 'object' && !Array.isArray(obj);
  }

  private mergeCliOptions(): void {
    if (this.cliOptions.skipRepoCheck) {
      this.config.repoProbe.enabled = false;
    }
    
    if (this.cliOptions.repoTimeout) {
      this.config.repoProbe.timeout = this.cliOptions.repoTimeout;
    }
    
    this.config.output.formats = this.cliOptions.format;
  }

  public getConfig(): Config {
    return this.config;
  }

  public getOrphanCriteria(): Config['orphanCriteria'] {
    return this.config.orphanCriteria;
  }

  public isRepoProbeEnabled(): boolean {
    return this.config.repoProbe.enabled;
  }

  public getServiceDirectories(): string[] {
    return this.config.serviceDirectories;
  }

  public getAlertRulePaths(): string[] {
    return this.config.alertRulePaths;
  }

  public getGithubApiBase(): string {
    return this.config.repoProbe.githubApiBase || 'https://api.github.com';
  }
}
