import fs from 'fs-extra';
import path from 'path';
import * as diff from 'diff';
import yaml from 'js-yaml';
import JSON5 from 'json5';
import { ConfigEntry, ConfigCheckResult, DriftItem, DiffChunk } from './types';
import _ from 'lodash';

export class ConfigComparator {
  async compare(
    repoPath: string,
    templatePath: string,
    configEntry: ConfigEntry,
    templateContent: string | null
  ): Promise<ConfigCheckResult> {
    const repoConfigPath = path.join(repoPath, configEntry.path);
    const exists = await fs.pathExists(repoConfigPath);
    
    const result: ConfigCheckResult = {
      path: configEntry.path,
      exists,
      required: configEntry.required,
      parsed: false,
      drifts: []
    };

    if (!exists) {
      if (configEntry.required) {
        result.drifts.push({
          id: this.generateId(),
          type: 'file_missing',
          path: configEntry.path,
          status: 'risk',
          description: `必需配置文件缺失: ${configEntry.path}`,
          severity: 'critical',
          reason: '模板要求此配置文件必须存在'
        });
      }
      return result;
    }

    try {
      const repoContent = await fs.readFile(repoConfigPath, 'utf-8');
      result.parsed = true;

      if (templateContent && configEntry.keys) {
        const repoConfig = this.parseConfig(repoContent, configEntry.type);
        const templateConfig = this.parseConfig(templateContent, configEntry.type);

        for (const key of configEntry.keys) {
          const repoValue = _.get(repoConfig, key);
          const templateValue = _.get(templateConfig, key);

          if (repoValue === undefined) {
            result.drifts.push({
              id: this.generateId(),
              type: 'config_missing_key',
              path: configEntry.path,
              status: 'risk',
              description: `配置项缺失: ${configEntry.path} > ${key}`,
              severity: 'high',
              reason: '模板要求此配置项必须存在',
              expected: JSON.stringify(templateValue)
            });
          } else if (!_.isEqual(repoValue, templateValue)) {
            const diffChunks = this.generateConfigDiff(
              JSON.stringify(templateValue, null, 2),
              JSON.stringify(repoValue, null, 2)
            );
            result.drifts.push({
              id: this.generateId(),
              type: 'config_value_diff',
              path: configEntry.path,
              status: 'risk',
              description: `配置值不同: ${configEntry.path} > ${key}`,
              severity: 'medium',
              reason: '配置值已偏离模板',
              diff: diffChunks,
              expected: JSON.stringify(templateValue),
              actual: JSON.stringify(repoValue)
            });
          }
        }
      }
    } catch (error: any) {
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        result.drifts.push({
          id: this.generateId(),
          type: 'permission_denied',
          path: configEntry.path,
          status: 'unknown',
          description: `无法读取配置文件: ${configEntry.path}`,
          severity: 'low',
          reason: '权限不足'
        });
      } else {
        result.drifts.push({
          id: this.generateId(),
          type: 'parse_error',
          path: configEntry.path,
          status: 'unknown',
          description: `解析配置文件失败: ${configEntry.path}`,
          severity: 'medium',
          reason: error.message
        });
      }
      result.parsed = false;
    }

    return result;
  }

  private parseConfig(content: string, type: string): any {
    switch (type) {
      case 'json':
        try {
          return JSON.parse(content);
        } catch {
          return JSON5.parse(content);
        }
      case 'yaml':
        return yaml.load(content);
      case 'env':
        return this.parseEnv(content);
      default:
        return content;
    }
  }

  private parseEnv(content: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        result[key.trim()] = valueParts.join('=').trim();
      }
    }
    
    return result;
  }

  private generateConfigDiff(expected: string, actual: string): DiffChunk[] {
    const diffResult = diff.diffLines(expected, actual);
    const chunks: DiffChunk[] = [];
    
    let lineCount = 1;
    for (const part of diffResult) {
      const chunk: DiffChunk = {
        type: part.added ? 'added' : part.removed ? 'removed' : 'unchanged',
        content: part.value,
        lineStart: lineCount
      };
      
      const lines = part.value.split('\n').length - 1;
      lineCount += lines;
      chunk.lineEnd = lineCount - 1;
      
      chunks.push(chunk);
    }
    
    return chunks;
  }

  private generateId(): string {
    return `drift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
