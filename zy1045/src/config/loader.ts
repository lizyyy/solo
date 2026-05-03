import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { MaskerConfig } from '../types';

export class ConfigLoader {
  static load(configPath: string): MaskerConfig {
    const absolutePath = path.resolve(configPath);
    
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`配置文件不存在: ${absolutePath}`);
    }

    const ext = path.extname(absolutePath).toLowerCase();
    const content = fs.readFileSync(absolutePath, 'utf-8');
    
    let rawConfig: any;
    
    if (ext === '.yaml' || ext === '.yml') {
      try {
        rawConfig = yaml.load(content);
      } catch (e) {
        throw new Error(`YAML解析失败: ${(e as Error).message}`);
      }
    } else if (ext === '.json') {
      try {
        rawConfig = JSON.parse(content);
      } catch (e) {
        throw new Error(`JSON解析失败: ${(e as Error).message}`);
      }
    } else {
      throw new Error(`不支持的配置文件格式: ${ext}，请使用 .yaml, .yml 或 .json`);
    }

    return this.normalizeConfig(rawConfig, path.dirname(absolutePath));
  }

  private static normalizeConfig(raw: any, baseDir: string): MaskerConfig {
    const config: MaskerConfig = {
      version: raw.version || '1.0',
      salt: raw.salt || this.generateDefaultSalt(),
      outputDir: raw.outputDir ? path.resolve(baseDir, raw.outputDir) : path.resolve(baseDir, 'masked_output'),
      dryRun: raw.dryRun || false,
      files: [],
      globalIgnoreFields: raw.globalIgnoreFields || [],
      preserveOriginalFilenames: raw.preserveOriginalFilenames !== undefined ? raw.preserveOriginalFilenames : true,
      outputFormat: raw.outputFormat || undefined,
    };

    if (raw.files && Array.isArray(raw.files)) {
      config.files = raw.files.map((fileConfig: any) => {
        const filePath = path.resolve(baseDir, fileConfig.path);
        const ext = path.extname(filePath).toLowerCase();
        const fileType = fileConfig.type || (ext === '.json' ? 'json' : 'csv');
        
        return {
          path: filePath,
          type: fileType as 'csv' | 'json',
          fields: this.normalizeFieldMapping(fileConfig.fields),
          ignoreFields: fileConfig.ignoreFields || [],
          keyField: fileConfig.keyField,
          jsonPath: fileConfig.jsonPath,
        };
      });
    }

    return config;
  }

  private static normalizeFieldMapping(fields: any): any {
    if (!fields) return {};
    
    const normalized: any = {};
    
    for (const [fieldName, fieldConfig] of Object.entries(fields)) {
      if (typeof fieldConfig === 'string') {
        normalized[fieldName] = { type: fieldConfig };
      } else if (typeof fieldConfig === 'object' && fieldConfig !== null) {
        normalized[fieldName] = {
          type: (fieldConfig as any).type,
          format: (fieldConfig as any).format,
        };
      }
    }
    
    return normalized;
  }

  private static generateDefaultSalt(): string {
    return 'default_salt_' + Date.now().toString(36);
  }

  static save(config: MaskerConfig, outputPath: string): void {
    const ext = path.extname(outputPath).toLowerCase();
    const content = ext === '.json' 
      ? JSON.stringify(config, null, 2) 
      : yaml.dump(config);
    
    fs.writeFileSync(outputPath, content, 'utf-8');
  }
}
