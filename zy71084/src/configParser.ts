import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { TargetConfig } from './types';

interface ConfigLine {
  lineNumber: number;
  content: string;
}

export class ConfigParser {
  static parseTargetsFromYaml(filePath: string): TargetConfig[] {
    if (!fs.existsSync(filePath)) {
      throw new Error(`配置文件不存在: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const lineMap = this.buildLineMap(lines);

    try {
      const data = yaml.load(content) as any;
      return this.parseTargetsData(data, filePath, lineMap);
    } catch (e) {
      throw new Error(`解析 YAML 配置失败: ${e}`);
    }
  }

  static parseTargetsFromJson(filePath: string): TargetConfig[] {
    if (!fs.existsSync(filePath)) {
      throw new Error(`配置文件不存在: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const lineMap = this.buildLineMap(lines);

    try {
      const data = JSON.parse(content);
      return this.parseTargetsData(data, filePath, lineMap);
    } catch (e) {
      throw new Error(`解析 JSON 配置失败: ${e}`);
    }
  }

  private static buildLineMap(lines: string[]): Map<string, number> {
    const map = new Map<string, number>();
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && !line.startsWith('#') && !line.startsWith('//')) {
        const keyMatch = line.match(/^["']?(\w+)["']?\s*[:=]/);
        if (keyMatch) {
          map.set(keyMatch[1].toLowerCase(), i + 1);
        }
        
        const bundleIdMatch = line.match(/["']?(bundleId|bundle_?id)["']?\s*[:=]\s*["']([^"']+)["']/i);
        if (bundleIdMatch) {
          map.set(`bundleid:${bundleIdMatch[2]}`, i + 1);
        }
        
        const nameMatch = line.match(/["']?(name|target)["']?\s*[:=]\s*["']([^"']+)["']/i);
        if (nameMatch) {
          map.set(`target:${nameMatch[2]}`, i + 1);
        }
      }
    }
    
    return map;
  }

  private static parseTargetsData(
    data: any,
    sourceFile: string,
    lineMap: Map<string, number>
  ): TargetConfig[] {
    const targets: TargetConfig[] = [];

    if (Array.isArray(data)) {
      data.forEach((item: any, index: number) => {
        const target = this.parseTargetItem(item, sourceFile, lineMap, index);
        targets.push(target);
      });
    } else if (data && typeof data === 'object') {
      if (data.targets && Array.isArray(data.targets)) {
        data.targets.forEach((item: any, index: number) => {
          const target = this.parseTargetItem(item, sourceFile, lineMap, index);
          targets.push(target);
        });
      } else {
        const target = this.parseTargetItem(data, sourceFile, lineMap, 0);
        targets.push(target);
      }
    }

    return targets;
  }

  private static parseTargetItem(
    item: any,
    sourceFile: string,
    lineMap: Map<string, number>,
    index: number
  ): TargetConfig {
    const name = item.name || item.target || `target-${index}`;
    const bundleId = item.bundleId || item.bundle_id || item.bundleid || '';
    
    let lineNumber = lineMap.get(`target:${name}`) || 
                     lineMap.get(`bundleid:${bundleId}`) ||
                     lineMap.get('targets') ||
                     lineMap.get('name') ||
                     (index + 1);

    return {
      name,
      bundleId,
      profileName: item.profileName || item.profile || item.profile_name,
      certificateName: item.certificateName || item.certificate || item.certificate_name,
      source: sourceFile,
      lineNumber
    };
  }

  static parseTargetsFromFile(filePath: string): TargetConfig[] {
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    if (ext === 'yaml' || ext === 'yml') {
      return this.parseTargetsFromYaml(filePath);
    } else if (ext === 'json') {
      return this.parseTargetsFromJson(filePath);
    } else {
      throw new Error(`不支持的配置文件格式: ${ext}`);
    }
  }

  static parseSimpleTarget(bundleId: string, name?: string): TargetConfig {
    return {
      name: name || bundleId,
      bundleId,
      source: 'cli',
      lineNumber: 0
    };
  }
}
