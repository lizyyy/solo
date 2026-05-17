import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { ServiceEntry, AlertReference, ProcessingError } from './types';
import { ConfigManager } from './config';

export class AlertChecker {
  private inputDir: string;
  private configManager: ConfigManager;
  private verbose: boolean;
  private errors: ProcessingError[] = [];

  constructor(inputDir: string, configManager: ConfigManager, verbose: boolean = false) {
    this.inputDir = inputDir;
    this.configManager = configManager;
    this.verbose = verbose;
  }

  public async checkAlertReferences(services: ServiceEntry[]): Promise<{
    results: Map<string, AlertReference[]>;
    errors: ProcessingError[];
  }> {
    this.errors = [];
    const results = new Map<string, AlertReference[]>();

    const alertFiles = this.findAlertFiles();
    
    if (alertFiles.length === 0) {
      return { results, errors: this.errors };
    }

    const serviceNames = services.map(s => s.name.toLowerCase());
    const serviceIds = services.map(s => s.id.toLowerCase());

    for (const alertFile of alertFiles) {
      const fileReferences = this.scanFileForServices(alertFile, serviceNames, serviceIds);
      
      for (const ref of fileReferences) {
        const service = services.find(s => 
          s.name.toLowerCase() === ref.serviceName.toLowerCase() ||
          s.id.toLowerCase() === ref.serviceName.toLowerCase()
        );
        
        if (service) {
          if (!results.has(service.id)) {
            results.set(service.id, []);
          }
          results.get(service.id)!.push({
            ...ref,
            serviceName: service.name
          });
        }
      }
    }

    return { results, errors: this.errors };
  }

  private findAlertFiles(): string[] {
    const patterns = this.configManager.getAlertRulePaths();
    const files: string[] = [];

    for (const pattern of patterns) {
      const resolvedPattern = path.resolve(this.inputDir, pattern);
      
      if (fs.existsSync(resolvedPattern)) {
        const stat = fs.statSync(resolvedPattern);
        if (stat.isFile()) {
          files.push(resolvedPattern);
        } else if (stat.isDirectory()) {
          const dirFiles = this.readDirectoryRecursive(resolvedPattern);
          files.push(...dirFiles);
        }
      } else {
        const globResults = this.globSearch(resolvedPattern);
        files.push(...globResults);
      }
    }

    return [...new Set(files)];
  }

  private readDirectoryRecursive(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.readDirectoryRecursive(fullPath));
      } else if (this.isAlertFile(entry.name)) {
        results.push(fullPath);
      }
    }

    return results;
  }

  private isAlertFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return ['.yaml', '.yml', '.json'].includes(ext);
  }

  private globSearch(pattern: string): string[] {
    const results: string[] = [];
    const baseDir = pattern.split('*')[0] || this.inputDir;
    
    if (fs.existsSync(baseDir) && fs.statSync(baseDir).isDirectory()) {
      const allFiles = this.readDirectoryRecursive(baseDir);
      const patternRegex = this.globToRegex(pattern);
      
      for (const file of allFiles) {
        if (patternRegex.test(file)) {
          results.push(file);
        }
      }
    }

    return results;
  }

  private globToRegex(glob: string): RegExp {
    let regex = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    regex = regex.replace(/\*\*/g, '.*');
    regex = regex.replace(/\*/g, '[^/]*');
    return new RegExp(regex);
  }

  private scanFileForServices(
    filePath: string,
    serviceNames: string[],
    serviceIds: string[]
  ): AlertReference[] {
    const references: AlertReference[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const ext = path.extname(filePath).toLowerCase();

      if (ext === '.yaml' || ext === '.yml') {
        this.scanYamlContent(content, lines, serviceNames, serviceIds, filePath, references);
      } else if (ext === '.json') {
        this.scanJsonContent(content, lines, serviceNames, serviceIds, filePath, references);
      }

      this.scanPlainText(content, lines, serviceNames, serviceIds, filePath, references);

    } catch (e: any) {
      this.errors.push({
        sourceFile: filePath,
        errorType: 'alert_check_error',
        message: `告警文件扫描失败: ${e.message}`
      });
    }

    return references;
  }

  private scanYamlContent(
    content: string,
    lines: string[],
    serviceNames: string[],
    serviceIds: string[],
    filePath: string,
    references: AlertReference[]
  ): void {
    try {
      const data = yaml.load(content);
      this.traverseObjectForServices(
        data,
        serviceNames,
        serviceIds,
        filePath,
        lines,
        references
      );
    } catch {
    }
  }

  private scanJsonContent(
    content: string,
    lines: string[],
    serviceNames: string[],
    serviceIds: string[],
    filePath: string,
    references: AlertReference[]
  ): void {
    try {
      const data = JSON.parse(content);
      this.traverseObjectForServices(
        data,
        serviceNames,
        serviceIds,
        filePath,
        lines,
        references
      );
    } catch {
    }
  }

  private traverseObjectForServices(
    obj: any,
    serviceNames: string[],
    serviceIds: string[],
    filePath: string,
    lines: string[],
    references: AlertReference[],
    depth: number = 0
  ): void {
    if (depth > 10 || obj === null || obj === undefined) {
      return;
    }

    if (typeof obj === 'string') {
      const lowerValue = obj.toLowerCase();
      
      for (const name of serviceNames) {
        if (lowerValue.includes(name)) {
          const lineNumber = this.findValueLineNumber(lines, obj);
          
          const existing = references.find(r => 
            r.sourceFile === filePath && 
            r.serviceName.toLowerCase() === name &&
            r.lineNumber === lineNumber
          );
          
          if (!existing) {
            const ruleId = this.extractRuleId(lines, lineNumber);
            references.push({
              ruleId,
              serviceName: name,
              isOrphan: false,
              sourceFile: filePath,
              lineNumber
            });
          }
        }
      }
      
      for (const id of serviceIds) {
        if (lowerValue.includes(id)) {
          const lineNumber = this.findValueLineNumber(lines, obj);
          
          const existing = references.find(r => 
            r.sourceFile === filePath && 
            r.serviceName.toLowerCase() === id &&
            r.lineNumber === lineNumber
          );
          
          if (!existing) {
            const ruleId = this.extractRuleId(lines, lineNumber);
            references.push({
              ruleId,
              serviceName: id,
              isOrphan: false,
              sourceFile: filePath,
              lineNumber
            });
          }
        }
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        this.traverseObjectForServices(
          item,
          serviceNames,
          serviceIds,
          filePath,
          lines,
          references,
          depth + 1
        );
      }
    } else if (typeof obj === 'object') {
      for (const value of Object.values(obj)) {
        this.traverseObjectForServices(
          value,
          serviceNames,
          serviceIds,
          filePath,
          lines,
          references,
          depth + 1
        );
      }
    }
  }

  private scanPlainText(
    content: string,
    lines: string[],
    serviceNames: string[],
    serviceIds: string[],
    filePath: string,
    references: AlertReference[]
  ): void {
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      const line = lines[lineNumber];
      const lowerLine = line.toLowerCase();

      for (const name of serviceNames) {
        if (lowerLine.includes(name)) {
          const existing = references.find(r => 
            r.sourceFile === filePath && 
            r.serviceName.toLowerCase() === name &&
            r.lineNumber === lineNumber + 1
          );
          
          if (!existing) {
            const ruleId = this.extractRuleId(lines, lineNumber + 1);
            references.push({
              ruleId,
              serviceName: name,
              isOrphan: false,
              sourceFile: filePath,
              lineNumber: lineNumber + 1
            });
          }
        }
      }

      for (const id of serviceIds) {
        if (lowerLine.includes(id)) {
          const existing = references.find(r => 
            r.sourceFile === filePath && 
            r.serviceName.toLowerCase() === id &&
            r.lineNumber === lineNumber + 1
          );
          
          if (!existing) {
            const ruleId = this.extractRuleId(lines, lineNumber + 1);
            references.push({
              ruleId,
              serviceName: id,
              isOrphan: false,
              sourceFile: filePath,
              lineNumber: lineNumber + 1
            });
          }
        }
      }
    }
  }

  private findValueLineNumber(lines: string[], value: string): number {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(value)) {
        return i + 1;
      }
    }
    return 1;
  }

  private extractRuleId(lines: string[], lineNumber: number): string {
    const startLine = Math.max(0, lineNumber - 10);
    for (let i = startLine; i < lineNumber; i++) {
      const line = lines[i];
      const alertMatch = line.match(/alert:\s*(\S+)/i) ||
                         line.match(/name:\s*(\S+)/i) ||
                         line.match(/rule:\s*(\S+)/i);
      if (alertMatch) {
        return alertMatch[1];
      }
    }
    return `line-${lineNumber}`;
  }

  public hasActiveAlerts(references: AlertReference[]): boolean {
    const criteria = this.configManager.getOrphanCriteria();
    
    if (!criteria.noAlertReferences) {
      return true;
    }

    return references.length > 0;
  }
}
