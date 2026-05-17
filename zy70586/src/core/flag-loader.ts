import fs from 'fs';
import path from 'path';
import { FeatureFlag, BadSample, MergeStrategy } from '../types';

export class FlagLoader {
  private badSamples: BadSample[] = [];

  public async loadFlags(
    flagsFile?: string,
    inlineFlags?: FeatureFlag[],
    defaultStrategy: MergeStrategy = { fileDefaultPriority: true, explicitDefaultOverride: true }
  ): Promise<{ flags: FeatureFlag[]; badSamples: BadSample[] }> {
    const fileFlags: FeatureFlag[] = [];
    
    if (flagsFile) {
      const loaded = await this.loadFlagsFromFile(flagsFile);
      fileFlags.push(...loaded.flags);
      this.badSamples.push(...loaded.badSamples);
    }

    if (inlineFlags && inlineFlags.length > 0) {
      const merged = this.mergeFlags(fileFlags, inlineFlags, defaultStrategy);
      return { flags: merged, badSamples: this.badSamples };
    }

    return { flags: fileFlags, badSamples: this.badSamples };
  }

  private async loadFlagsFromFile(filePath: string): Promise<{ flags: FeatureFlag[]; badSamples: BadSample[] }> {
    const flags: FeatureFlag[] = [];
    const badSamples: BadSample[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const ext = path.extname(filePath).toLowerCase();

      if (ext === '.json') {
        const parsed = JSON.parse(content);
        const flagList = Array.isArray(parsed) ? parsed : parsed.flags || parsed;
        
        if (!Array.isArray(flagList)) {
          badSamples.push({
            filePath,
            reason: '无效的开关清单格式，期望是数组或包含flags字段的对象',
            errorType: 'parse-error',
            rawContent: content.slice(0, 500)
          });
          return { flags: [], badSamples };
        }

        for (let i = 0; i < flagList.length; i++) {
          const item = flagList[i];
          try {
            const flag = this.validateAndNormalizeFlag(item, filePath);
            flags.push(flag);
          } catch (error) {
            badSamples.push({
              filePath,
              lineNumber: i + 1,
              reason: error instanceof Error ? error.message : '未知错误',
              errorType: 'invalid-default',
              rawContent: JSON.stringify(item)
            });
          }
        }
      } else if (ext === '.csv') {
        const lines = content.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const values = lines[i].split(',').map(v => v.trim());
          try {
            const flag: FeatureFlag = {
              name: values[headers.indexOf('name')] || values[0],
              defaultValue: this.parseBoolean(values[headers.indexOf('defaultValue')] || values[1]),
              description: values[headers.indexOf('description')] || values[2],
              source: filePath
            };
            flags.push(this.validateAndNormalizeFlag(flag, filePath));
          } catch (error) {
            badSamples.push({
              filePath,
              lineNumber: i + 1,
              reason: error instanceof Error ? error.message : '未知错误',
              errorType: 'invalid-default',
              rawContent: lines[i]
            });
          }
        }
      } else {
        badSamples.push({
          filePath,
          reason: `不支持的文件格式: ${ext}，仅支持 JSON 和 CSV`,
          errorType: 'parse-error'
        });
      }
    } catch (error) {
      badSamples.push({
        filePath,
        reason: error instanceof Error ? error.message : '文件读取失败',
        errorType: 'parse-error',
        rawContent: error instanceof Error ? error.stack : undefined
      });
    }

    return { flags, badSamples };
  }

  private validateAndNormalizeFlag(flag: any, source: string): FeatureFlag {
    if (!flag || typeof flag !== 'object') {
      throw new Error('开关必须是对象类型');
    }

    if (!flag.name || typeof flag.name !== 'string' || flag.name.trim() === '') {
      throw new Error('开关名称(name)不能为空');
    }

    if (flag.defaultValue === undefined) {
      throw new Error(`开关 ${flag.name} 缺少 defaultValue 字段`);
    }

    const defaultValue = this.parseBoolean(flag.defaultValue);

    return {
      name: flag.name.trim(),
      defaultValue,
      description: flag.description?.toString(),
      source: flag.source || source
    };
  }

  private parseBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      if (['true', '1', 'yes', 'on'].includes(lower)) return true;
      if (['false', '0', 'no', 'off'].includes(lower)) return false;
    }
    throw new Error(`无法将 "${value}" 解析为布尔值`);
  }

  private mergeFlags(
    fileFlags: FeatureFlag[],
    inlineFlags: FeatureFlag[],
    strategy: MergeStrategy
  ): FeatureFlag[] {
    const flagMap = new Map<string, FeatureFlag>();

    const primarySource = strategy.fileDefaultPriority ? fileFlags : inlineFlags;
    const secondarySource = strategy.fileDefaultPriority ? inlineFlags : fileFlags;

    for (const flag of primarySource) {
      flagMap.set(flag.name, flag);
    }

    for (const flag of secondarySource) {
      const existing = flagMap.get(flag.name);
      if (!existing) {
        flagMap.set(flag.name, flag);
      } else if (strategy.explicitDefaultOverride && flag.source) {
        flagMap.set(flag.name, { ...existing, ...flag });
      }
    }

    return Array.from(flagMap.values());
  }
}
