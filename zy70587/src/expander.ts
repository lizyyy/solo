import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import {
  ExpandResult,
  ExpandOptions,
  AnchorInfo,
  ValueOverride,
  YamlError,
  SourceLocation,
} from './types';

interface MergeNodeInfo {
  fullPath: string;
  location: SourceLocation;
  sources: { anchorName: string; location: SourceLocation; keys: string[] }[];
}

class YamlExpander {
  private options: ExpandOptions;
  private originalContent: string = '';
  private lines: string[] = [];
  private anchors: Map<string, AnchorInfo> = new Map();
  private overrides: ValueOverride[] = [];
  private errors: YamlError[] = [];
  private warnings: YamlError[] = [];
  private mergeNodes: MergeNodeInfo[] = [];
  private lineToAnchor: Map<number, string> = new Map();
  private lineToPath: Map<number, string> = new Map();

  constructor(options: ExpandOptions) {
    this.options = options;
  }

  expand(): ExpandResult {
    const timestamp = new Date().toISOString();
    const outputBase = this.options.outputBase || this.getOutputBase(timestamp);

    try {
      this.originalContent = fs.readFileSync(this.options.inputFile, 'utf-8');
      this.lines = this.originalContent.split('\n');
    } catch (error) {
      this.errors.push({
        message: `无法读取输入文件: ${(error as Error).message}`,
        location: { line: 0, column: 0 },
        severity: 'error',
      });
      return this.buildResult(false, 1, outputBase, timestamp, '');
    }

    let expandedYaml = '';
    let doc: any = null;
    try {
      this.scanAnchorsByLine();

      doc = yaml.load(this.originalContent, {
        filename: this.options.inputFile,
      }) as any;

      this.buildPathMapping(doc, '');

      this.collectAnchorsFirst(doc, '');

      this.processMergesFromScan(doc);

      const expanded = this.expandNode(doc, '');
      expandedYaml = yaml.dump(expanded, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
      });
    } catch (error) {
      const yamlError = error as yaml.YAMLException;
      this.errors.push({
        message: yamlError.message || 'YAML解析错误',
        location: {
          line: (yamlError.mark?.line ?? 0) + 1,
          column: (yamlError.mark?.column ?? 0) + 1,
        },
        severity: 'error',
        context: this.getLineContext(yamlError.mark?.line ?? 0),
      });
      return this.buildResult(false, 2, outputBase, timestamp, '');
    }

    const exitCode = this.errors.length > 0 ? 3 : 0;
    return this.buildResult(
      exitCode === 0,
      exitCode,
      outputBase,
      timestamp,
      expandedYaml
    );
  }

  private scanAnchorsByLine(): void {
    const anchorRegex = /&\s*(\w+)/g;
    for (let lineNum = 0; lineNum < this.lines.length; lineNum++) {
      const line = this.lines[lineNum];
      let match;
      while ((match = anchorRegex.exec(line)) !== null) {
        const anchorName = match[1];
        this.anchors.set(anchorName, {
          name: anchorName,
          location: { line: lineNum + 1, column: match.index + 1 },
          value: null,
        });
        this.lineToAnchor.set(lineNum + 1, anchorName);
      }
    }
  }

  private findMergeLines(): { line: number; column: number; aliases: string[] }[] {
    const results: { line: number; column: number; aliases: string[] }[] = [];
    const singleMergeRegex = /<<:\s*\*\s*(\w+)/g;
    const multiMergeRegex = /<<:\s*\[\s*([^\]]+)\s*\]/g;

    for (let lineNum = 0; lineNum < this.lines.length; lineNum++) {
      const line = this.lines[lineNum];
      let match;

      while ((match = singleMergeRegex.exec(line)) !== null) {
        results.push({
          line: lineNum + 1,
          column: match.index + 1,
          aliases: [match[1]],
        });
      }

      while ((match = multiMergeRegex.exec(line)) !== null) {
        const aliases = match[1].split(',').map(a => a.trim().replace(/^\*/, ''));
        results.push({
          line: lineNum + 1,
          column: match.index + 1,
          aliases,
        });
      }
    }
    return results;
  }

  private findPathForLine(targetLine: number): string {
    const fallbackPath = this.findFallbackPath(targetLine);

    let bestMatch = '';
    let bestMatchLine = 0;
    for (const [line, path] of this.lineToPath) {
      if (line < targetLine && line > bestMatchLine) {
        bestMatchLine = line;
        bestMatch = path;
      }
    }

    return fallbackPath.length >= bestMatch.length ? fallbackPath : bestMatch;
  }

  private findFallbackPath(targetLine: number): string {
    const pathStack: string[] = [];
    const indentStack: number[] = [];

    for (let lineNum = 0; lineNum < targetLine; lineNum++) {
      const line = this.lines[lineNum];
      const indent = line.search(/\S/);
      if (indent === -1) continue;

      const keyMatch = line.match(/^\s*(\w+):/);
      if (keyMatch) {
        while (indentStack.length > 0 && indentStack[indentStack.length - 1] >= indent) {
          pathStack.pop();
          indentStack.pop();
        }
        pathStack.push(keyMatch[1]);
        indentStack.push(indent);
      }
    }
    return pathStack.join('.');
  }

  private getValueAtPath(doc: any, path: string): any {
    if (!path) return doc;
    const parts = path.split('.');
    let current = doc;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return null;
      }
    }
    return current;
  }

  private processMergesFromScan(doc: any): void {
    const mergeLines = this.findMergeLines();
    const mergeByPath: Map<string, { mergeInfos: any[]; node: any }> = new Map();

    for (const mergeInfo of mergeLines) {
      const path = this.findPathForLine(mergeInfo.line);
      const node = this.getValueAtPath(doc, path);
      if (!node || typeof node !== 'object') continue;

      if (!mergeByPath.has(path)) {
        mergeByPath.set(path, { mergeInfos: [], node });
      }
      mergeByPath.get(path)!.mergeInfos.push(mergeInfo);
    }

    for (const [path, data] of mergeByPath) {
      const { mergeInfos, node } = data;

      let allSources: { anchorName: string; location: SourceLocation; keys: string[] }[] = [];
      let firstLocation = { line: 0, column: 0 };

      for (let i = 0; i < mergeInfos.length; i++) {
        const mergeInfo = mergeInfos[i];
        if (i === 0) {
          firstLocation = { line: mergeInfo.line, column: mergeInfo.column };
        }

        for (const alias of mergeInfo.aliases) {
          const anchorInfo = this.anchors.get(alias);
          if (anchorInfo) {
            const keys = anchorInfo.value && typeof anchorInfo.value === 'object'
              ? Object.keys(anchorInfo.value)
              : [];
            allSources.push({
              anchorName: alias,
              location: anchorInfo.location,
              keys,
            });

            if (anchorInfo.value && typeof anchorInfo.value === 'object') {
              const explicitKeys = Object.keys(node).filter(k => k !== '<<');
              for (const [key, oldValue] of Object.entries(anchorInfo.value)) {
                if (explicitKeys.includes(key)) {
                  const newValue = node[key];
                  if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                    const existingOverride = this.overrides.find(o => o.path === path && o.key === key);
                    if (!existingOverride) {
                      this.overrides.push({
                        path,
                        key,
                        oldValue,
                        newValue,
                        sourceAnchor: alias,
                        overrideLocation: this.findOverrideLocation(path, key),
                      });
                    }
                  }
                }
              }
            }
          }
        }
      }

      if (allSources.length > 0) {
        this.mergeNodes.push({
          fullPath: path,
          location: firstLocation,
          sources: allSources,
        });
      }
    }
  }

  private buildPathMapping(node: any, currentPath: string): void {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;
      const keyLine = this.findKeyLine(currentPath, key);
      if (keyLine > 0) {
        this.lineToPath.set(keyLine, newPath);
      }
      this.buildPathMapping(value, newPath);
    }
  }

  private collectAnchorsFirst(node: any, currentPath: string): void {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      return;
    }

    for (const anchorName of this.anchors.keys()) {
      const anchorInfo = this.anchors.get(anchorName)!;
      if (anchorInfo.value === null) {
        const anchorLine = anchorInfo.location.line - 1;
        const pathParts = currentPath.split('.');
        const lastKey = pathParts[pathParts.length - 1];

        for (let i = Math.max(0, anchorLine - 1); i <= anchorLine; i++) {
          const line = this.lines[i].trim();
          if (line.startsWith(`${lastKey}:`)) {
            anchorInfo.value = node;
            break;
          }
        }
      }
    }

    for (const [key, value] of Object.entries(node)) {
      if (key !== '<<') {
        const newPath = currentPath ? `${currentPath}.${key}` : key;
        this.collectAnchorsFirst(value, newPath);
      }
    }
  }

  private findOverrideLocation(currentPath: string, key: string): SourceLocation {
    const pathParts = currentPath.split('.');
    let searchStart = 0;

    const parentLine = this.findPathLine(currentPath);
    if (parentLine > 0) {
      searchStart = parentLine;
    }

    const indentLevel = pathParts.length;
    const keyRegex = new RegExp(`^\\s{${indentLevel * 2}}${key}:\\s*`);
    const looseRegex = new RegExp(`^\\s+${key}:\\s*`);

    for (let lineNum = searchStart; lineNum < Math.min(searchStart + 20, this.lines.length); lineNum++) {
      const line = this.lines[lineNum];
      if (keyRegex.test(line) || looseRegex.test(line)) {
        return { line: lineNum + 1, column: line.indexOf(key) + 1 };
      }
    }
    return { line: 0, column: 0 };
  }

  private findPathLine(path: string): number {
    for (const [line, p] of this.lineToPath) {
      if (p === path) {
        return line;
      }
    }

    const parts = path.split('.');
    let currentLine = 0;
    let currentSearch = 0;

    for (const part of parts) {
      for (let lineNum = currentSearch; lineNum < this.lines.length; lineNum++) {
        const trimmed = this.lines[lineNum].trim();
        if (trimmed.startsWith(`${part}:`)) {
          currentLine = lineNum + 1;
          currentSearch = lineNum + 1;
          break;
        }
      }
    }
    return currentLine;
  }

  private findKeyLine(parentPath: string, key: string): number {
    const parentLine = this.findPathLine(parentPath);
    const indentLevel = parentPath ? parentPath.split('.').length : 0;

    const keyRegex = new RegExp(`^\\s{${indentLevel * 2}}${key}:\\s*`);

    for (let lineNum = parentLine; lineNum < Math.min(parentLine + 30, this.lines.length); lineNum++) {
      if (keyRegex.test(this.lines[lineNum])) {
        return lineNum + 1;
      }
    }
    return 0;
  }

  private expandNode(node: any, path: string): any {
    if (!node || typeof node !== 'object') {
      return node;
    }

    if (Array.isArray(node)) {
      return node.map((item, index) => this.expandNode(item, `${path}[${index}]`));
    }

    const result: any = {};
    const mergeSources: any[] = [];

    for (const [key, value] of Object.entries(node)) {
      if (key === '<<') {
        if (Array.isArray(value)) {
          mergeSources.push(...value);
        } else {
          mergeSources.push(value);
        }
      } else {
        result[key] = this.expandNode(value, `${path}.${key}`);
      }
    }

    for (let i = mergeSources.length - 1; i >= 0; i--) {
      const mergeSource = mergeSources[i];
      if (mergeSource && typeof mergeSource === 'object') {
        for (const [key, value] of Object.entries(mergeSource)) {
          if (!(key in result)) {
            result[key] = this.expandNode(value, `${path}.${key}`);
          }
        }
      }
    }

    return result;
  }

  private getOutputBase(timestamp: string): string {
    const baseName =
      path
        .basename(this.options.inputFile)
        .replace(/\.ya?ml$/i, '') || 'output';
    const ts = timestamp.replace(/[:.]/g, '-');
    return `${baseName}-expanded-${ts}`;
  }

  private getLineContext(lineNumber: number): string {
    const context: string[] = [];
    for (
      let i = Math.max(0, lineNumber - 2);
      i <= lineNumber + 2 && i < this.lines.length;
      i++
    ) {
      const prefix = i === lineNumber ? '> ' : '  ';
      context.push(`${prefix}${i + 1}: ${this.lines[i]}`);
    }
    return context.join('\n');
  }

  private buildResult(
    success: boolean,
    exitCode: number,
    outputBase: string,
    timestamp: string,
    expandedYaml: string
  ): ExpandResult {
    return {
      success,
      exitCode,
      inputFile: this.options.inputFile,
      outputBase,
      timestamp,
      originalYaml: this.originalContent,
      expandedYaml,
      anchors: Array.from(this.anchors.values()),
      mergeNodes: this.mergeNodes.map(m => ({
        path: m.fullPath,
        location: m.location,
        sources: m.sources,
      })),
      overrides: this.overrides,
      errors: this.errors,
      warnings: this.warnings,
      statistics: {
        totalAnchors: this.anchors.size,
        totalMerges: this.mergeNodes.length,
        totalOverrides: this.overrides.length,
        totalErrors: this.errors.length,
        totalWarnings: this.warnings.length,
      },
    };
  }
}

export function expandYaml(options: ExpandOptions): ExpandResult {
  const expander = new YamlExpander(options);
  return expander.expand();
}
