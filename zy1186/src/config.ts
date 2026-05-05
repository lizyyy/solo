import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { WriteConfig } from './types';

const DEFAULT_CONFIG: WriteConfig = {
  benchmark: {
    warmupRuns: 2,
    testRuns: 3,
    recordCount: 10000,
  },
  strategies: {
    transactionModes: ['single', 'batch'],
    batchSizes: [100, 500, 1000, 5000],
    journalModes: ['DELETE', 'WAL'],
    connectionModes: ['reuse', 'reopen'],
    statementModes: ['direct', 'prepared'],
  },
  indexAnalysis: {
    enable: true,
    testWithoutIndexes: true,
    testWithExtraIndexes: false,
    extraIndexColumns: [],
  },
  output: {
    formats: ['markdown', 'json'],
    outputDir: './reports',
  },
};

export class ConfigLoader {
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || './write-config.yaml';
  }

  load(): WriteConfig {
    let config: WriteConfig;

    if (fs.existsSync(this.configPath)) {
      const fileContent = fs.readFileSync(this.configPath, 'utf-8');
      try {
        const parsed = yaml.parse(fileContent);
        config = this.mergeWithDefaults(parsed);
        this.validateConfig(config);
      } catch (error) {
        throw new Error(`配置文件解析失败: ${(error as Error).message}`);
      }
    } else {
      console.warn(`警告: 配置文件 ${this.configPath} 不存在，使用默认配置`);
      config = { ...DEFAULT_CONFIG };
    }

    return config;
  }

  private mergeWithDefaults(userConfig: Partial<WriteConfig>): WriteConfig {
    return {
      benchmark: {
        ...DEFAULT_CONFIG.benchmark,
        ...userConfig.benchmark,
      },
      strategies: {
        ...DEFAULT_CONFIG.strategies,
        ...userConfig.strategies,
      },
      indexAnalysis: {
        ...DEFAULT_CONFIG.indexAnalysis,
        ...userConfig.indexAnalysis,
      },
      output: {
        ...DEFAULT_CONFIG.output,
        ...userConfig.output,
      },
    };
  }

  private validateConfig(config: WriteConfig): void {
    const errors: string[] = [];

    if (config.benchmark.warmupRuns < 0) {
      errors.push('warmupRuns 不能为负数');
    }
    if (config.benchmark.testRuns < 1) {
      errors.push('testRuns 必须至少为 1');
    }
    if (config.benchmark.recordCount < 100) {
      errors.push('recordCount 建议至少为 100 以获得有意义的测试结果');
    }

    const validJournalModes = ['DELETE', 'WAL', 'MEMORY', 'OFF'];
    for (const mode of config.strategies.journalModes) {
      if (!validJournalModes.includes(mode)) {
        errors.push(`无效的 journalMode: ${mode}。有效值: ${validJournalModes.join(', ')}`);
      }
    }

    for (const batchSize of config.strategies.batchSizes) {
      if (batchSize < 1) {
        errors.push(`batchSize 不能小于 1: ${batchSize}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`配置验证失败:\n  - ${errors.join('\n  - ')}`);
    }
  }

  generateDefaultConfig(outputPath?: string): string {
    const content = yaml.stringify(DEFAULT_CONFIG);
    const outputFilePath = outputPath || this.configPath;
    
    if (outputFilePath) {
      fs.writeFileSync(outputFilePath, content, 'utf-8');
      console.log(`默认配置已生成: ${outputFilePath}`);
    }
    
    return content;
  }
}
