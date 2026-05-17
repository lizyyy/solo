import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { FeatureFlag, CodeReference, DeadBranch, BadSample } from '../types';

export class CodeScanner {
  private badSamples: BadSample[] = [];
  private flagPatterns: RegExp[] = [];

  public async scanDirectory(
    sourceDir: string,
    flags: FeatureFlag[],
    filePatterns: string[],
    excludePatterns: string[]
  ): Promise<{
    references: CodeReference[];
    deadBranches: DeadBranch[];
    badSamples: BadSample[];
    filesScanned: number;
  }> {
    this.flagPatterns = flags.map(flag => new RegExp(`\\b${flag.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'));
    
    const files = await this.findFiles(sourceDir, filePatterns, excludePatterns);
    const allReferences: CodeReference[] = [];
    const allDeadBranches: DeadBranch[] = [];
    const flagMap = new Map(flags.map(f => [f.name, f]));

    for (const file of files) {
      try {
        const { references, deadBranches } = await this.scanFile(file, flags, flagMap);
        allReferences.push(...references);
        allDeadBranches.push(...deadBranches);
      } catch (error) {
        this.badSamples.push({
          filePath: file,
          reason: error instanceof Error ? error.message : '文件扫描失败',
          errorType: 'parse-error',
          rawContent: error instanceof Error ? error.stack : undefined
        });
      }
    }

    return {
      references: allReferences,
      deadBranches: allDeadBranches,
      badSamples: this.badSamples,
      filesScanned: files.length
    };
  }

  private async findFiles(
    sourceDir: string,
    filePatterns: string[],
    excludePatterns: string[]
  ): Promise<string[]> {
    const files: string[] = [];
    
    for (const pattern of filePatterns) {
      const matches = await glob(pattern, {
        cwd: sourceDir,
        ignore: excludePatterns,
        nodir: true,
        absolute: true
      });
      files.push(...matches);
    }

    return [...new Set(files)];
  }

  private async scanFile(
    filePath: string,
    flags: FeatureFlag[],
    flagMap: Map<string, FeatureFlag>
  ): Promise<{ references: CodeReference[]; deadBranches: DeadBranch[] }> {
    const references: CodeReference[] = [];
    const deadBranches: DeadBranch[] = [];

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const relativePath = path.relative(process.cwd(), filePath);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      
      for (const flag of flags) {
        const flagPattern = new RegExp(`\\b${flag.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
        let match;
        
        while ((match = flagPattern.exec(line)) !== null) {
          const column = match.index + 1;
          const context = this.extractContext(lines, lineIndex);
          const contextType = this.detectContextType(context);
          
          const reference: CodeReference = {
            flagName: flag.name,
            filePath: relativePath,
            lineNumber: lineIndex + 1,
            column,
            context,
            contextType,
            rawCode: line.trim()
          };
          
          references.push(reference);

          const deadBranch = this.analyzeDeadBranch(reference, flag, lines, lineIndex);
          if (deadBranch) {
            deadBranches.push(deadBranch);
          }
        }
      }
    }

    return { references, deadBranches };
  }

  private extractContext(lines: string[], lineIndex: number): string {
    const start = Math.max(0, lineIndex - 2);
    const end = Math.min(lines.length - 1, lineIndex + 2);
    return lines.slice(start, end + 1).join('\n');
  }

  private detectContextType(context: string): CodeReference['contextType'] {
    if (/^\s*if\s*\(/.test(context)) return 'if';
    if (/^\s*else/.test(context)) return 'else';
    if (/\?.*:/.test(context)) return 'ternary';
    if (/\w+\s*\(/.test(context)) return 'function-call';
    return 'other';
  }

  private analyzeDeadBranch(
    reference: CodeReference,
    flag: FeatureFlag,
    lines: string[],
    lineIndex: number
  ): DeadBranch | null {
    const { contextType, filePath, lineNumber, column, flagName, rawCode } = reference;
    const { defaultValue } = flag;

    let branchType: DeadBranch['branchType'] | null = null;
    let suggestion = '';
    let confidence: DeadBranch['confidence'] = 'medium';

    switch (contextType) {
      case 'if': {
        const isNegated = this.isNegated(rawCode, flagName);
        const effectiveValue = isNegated ? !defaultValue : defaultValue;

        if (effectiveValue) {
          branchType = 'false-branch';
          suggestion = '可以删除 else 分支，保留 if 内代码，移除 if 条件判断';
          confidence = 'high';
        } else {
          branchType = 'true-branch';
          suggestion = '可以删除 if 内代码，保留 else 分支，或直接移除整个条件';
          confidence = 'high';
        }
        break;
      }

      case 'ternary': {
        const isNegated = this.isNegated(rawCode, flagName);
        const effectiveValue = isNegated ? !defaultValue : defaultValue;

        if (effectiveValue) {
          branchType = 'false-branch';
          suggestion = '可以简化三元表达式，直接使用冒号前的表达式结果';
          confidence = 'high';
        } else {
          branchType = 'true-branch';
          suggestion = '可以简化三元表达式，直接使用冒号后的表达式结果';
          confidence = 'high';
        }
        break;
      }

      case 'else': {
        break;
      }

      default: {
        branchType = 'entire-condition';
        suggestion = defaultValue 
          ? '该开关默认为 true，可以考虑移除该条件判断' 
          : '该开关默认为 false，可以考虑移除该条件判断';
        confidence = 'low';
      }
    }

    if (!branchType) return null;

    return {
      flagName,
      filePath,
      lineNumber,
      column,
      branchType,
      defaultValue,
      context: this.extractContext(lines, lineIndex),
      suggestion,
      rawCode,
      confidence
    };
  }

  private isNegated(code: string, flagName: string): boolean {
    const escapedFlag = flagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const negationPattern = new RegExp(`!\\s*\\b${escapedFlag}\\b`);
    const notPattern = new RegExp(`not\\s+${escapedFlag}\\b`, 'i');
    return negationPattern.test(code) || notPattern.test(code);
  }
}
