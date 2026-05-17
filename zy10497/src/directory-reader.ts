import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import csv from 'csv-parser';
import { ServiceEntry, ProcessingError } from './types';
import { ConfigManager } from './config';

export class DirectoryReader {
  private inputDir: string;
  private configManager: ConfigManager;
  private verbose: boolean;
  private errors: ProcessingError[] = [];

  constructor(inputDir: string, configManager: ConfigManager, verbose: boolean = false) {
    this.inputDir = inputDir;
    this.configManager = configManager;
    this.verbose = verbose;
  }

  public async readAllServices(): Promise<{ services: ServiceEntry[]; errors: ProcessingError[] }> {
    this.errors = [];
    const services: ServiceEntry[] = [];

    const patterns = this.configManager.getServiceDirectories();
    const files = this.findMatchingFiles(patterns);

    if (files.length === 0) {
      this.errors.push({
        sourceFile: this.inputDir,
        errorType: 'parse_error',
        message: '未找到任何服务目录文件'
      });
      return { services: [], errors: this.errors };
    }

    for (const file of files) {
      const fileServices = await this.readFile(file);
      services.push(...fileServices);
    }

    return { services, errors: this.errors };
  }

  private findMatchingFiles(patterns: string[]): string[] {
    const files: string[] = [];
    const alertPatterns = this.configManager.getAlertRulePaths().map(p => 
      path.resolve(this.inputDir, p)
    );

    for (const pattern of patterns) {
      const resolvedPattern = path.resolve(this.inputDir, pattern);
      
      if (fs.existsSync(resolvedPattern)) {
        const stat = fs.statSync(resolvedPattern);
        if (stat.isFile()) {
          if (!this.isAlertFile(resolvedPattern, alertPatterns)) {
            files.push(resolvedPattern);
          }
        } else if (stat.isDirectory()) {
          const dirFiles = this.readDirectoryRecursive(resolvedPattern, alertPatterns);
          files.push(...dirFiles);
        }
      } else {
        const globResults = this.globSearch(resolvedPattern, alertPatterns);
        files.push(...globResults);
      }
    }

    return [...new Set(files)];
  }

  private isAlertFile(filePath: string, alertPatterns: string[]): boolean {
    for (const pattern of alertPatterns) {
      const regex = this.globToRegex(pattern);
      if (regex.test(filePath)) {
        return true;
      }
    }
    return false;
  }

  private readDirectoryRecursive(dir: string, alertPatterns: string[] = []): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.readDirectoryRecursive(fullPath, alertPatterns));
      } else if (this.isSupportedFile(entry.name) && !this.isAlertFile(fullPath, alertPatterns)) {
        results.push(fullPath);
      }
    }

    return results;
  }

  private isSupportedFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return ['.yaml', '.yml', '.json', '.csv'].includes(ext);
  }

  private globSearch(pattern: string, alertPatterns: string[] = []): string[] {
    const results: string[] = [];
    const baseDir = pattern.split('*')[0] || this.inputDir;
    
    if (fs.existsSync(baseDir) && fs.statSync(baseDir).isDirectory()) {
      const allFiles = this.readDirectoryRecursive(baseDir, alertPatterns);
      const patternRegex = this.globToRegex(pattern);
      
      for (const file of allFiles) {
        if (patternRegex.test(file) && !this.isAlertFile(file, alertPatterns)) {
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

  private async readFile(filePath: string): Promise<ServiceEntry[]> {
    const ext = path.extname(filePath).toLowerCase();
    
    try {
      switch (ext) {
        case '.yaml':
        case '.yml':
          return this.readYamlFile(filePath);
        case '.json':
          return this.readJsonFile(filePath);
        case '.csv':
          return this.readCsvFile(filePath);
        default:
          this.errors.push({
            sourceFile: filePath,
            errorType: 'parse_error',
            message: `不支持的文件格式: ${ext}`
          });
          return [];
      }
    } catch (e: any) {
      this.errors.push({
        sourceFile: filePath,
        errorType: 'parse_error',
        message: `文件读取失败: ${e.message}`
      });
      return [];
    }
  }

  private readYamlFile(filePath: string): ServiceEntry[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const services: ServiceEntry[] = [];

    try {
      const data = yaml.load(content);
      
      if (Array.isArray(data)) {
        data.forEach((item, index) => {
          const service = this.parseServiceItem(item, filePath, this.findLineNumber(lines, item, index));
          if (service) {
            services.push(service);
          }
        });
      } else if (data && typeof data === 'object') {
        if ('services' in data && Array.isArray((data as any).services)) {
          (data as any).services.forEach((item: any, index: number) => {
            const service = this.parseServiceItem(item, filePath, this.findLineNumber(lines, item, index));
            if (service) {
              services.push(service);
            }
          });
        } else {
          const service = this.parseServiceItem(data, filePath, 1);
          if (service) {
            services.push(service);
          }
        }
      }

      return services;
    } catch (e: any) {
      this.errors.push({
        sourceFile: filePath,
        errorType: 'parse_error',
        message: `YAML解析失败: ${e.message}`,
        rawData: content.substring(0, 500)
      });
      return [];
    }
  }

  private readJsonFile(filePath: string): ServiceEntry[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const services: ServiceEntry[] = [];

    try {
      const data = JSON.parse(content);
      
      if (Array.isArray(data)) {
        data.forEach((item, index) => {
          const service = this.parseServiceItem(item, filePath, index + 1);
          if (service) {
            services.push(service);
          }
        });
      } else if (data && typeof data === 'object') {
        if ('services' in data && Array.isArray(data.services)) {
          data.services.forEach((item: any, index: number) => {
            const service = this.parseServiceItem(item, filePath, index + 1);
            if (service) {
              services.push(service);
            }
          });
        } else {
          const service = this.parseServiceItem(data, filePath, 1);
          if (service) {
            services.push(service);
          }
        }
      }

      return services;
    } catch (e: any) {
      this.errors.push({
        sourceFile: filePath,
        errorType: 'parse_error',
        message: `JSON解析失败: ${e.message}`,
        rawData: content.substring(0, 500)
      });
      return [];
    }
  }

  private async readCsvFile(filePath: string): Promise<ServiceEntry[]> {
    const services: ServiceEntry[] = [];
    
    return new Promise((resolve) => {
      let lineNumber = 1;
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          lineNumber++;
          const service = this.parseServiceItem(row, filePath, lineNumber);
          if (service) {
            services.push(service);
          }
        })
        .on('end', () => {
          resolve(services);
        })
        .on('error', (e: any) => {
          this.errors.push({
            sourceFile: filePath,
            errorType: 'parse_error',
            message: `CSV解析失败: ${e.message}`
          });
          resolve(services);
        });
    });
  }

  private parseServiceItem(item: any, sourceFile: string, lineNumber: number): ServiceEntry | null {
    try {
      const name = item.name || item.serviceName || item.service || '';
      const id = item.id || item.serviceId || name.toLowerCase().replace(/\s+/g, '-');

      if (!name) {
        this.errors.push({
          serviceId: id,
          sourceFile,
          lineNumber,
          errorType: 'validation_error',
          message: '缺少服务名称',
          rawData: JSON.stringify(item)
        });
        return null;
      }

      const owners = this.parseOwners(item);
      const alertRules = this.parseAlertRules(item);

      return {
        id,
        name,
        repoUrl: item.repoUrl || item.repository || item.repo,
        owners,
        alertRules,
        status: this.parseStatus(item),
        lastUpdated: item.lastUpdated || item.updatedAt || item.modified,
        sourceFile,
        lineNumber
      };
    } catch (e: any) {
      this.errors.push({
        sourceFile,
        lineNumber,
        errorType: 'validation_error',
        message: `服务条目解析失败: ${e.message}`,
        rawData: JSON.stringify(item)
      });
      return null;
    }
  }

  private parseOwners(item: any): string[] {
    const owners = item.owners || item.owner || item.maintainers || item.team;
    
    if (Array.isArray(owners)) {
      return owners.filter(o => typeof o === 'string' && o.trim());
    } else if (typeof owners === 'string') {
      return owners.split(/[,，;；]/).map(o => o.trim()).filter(o => o);
    }
    
    return [];
  }

  private parseAlertRules(item: any): string[] {
    const alerts = item.alertRules || item.alerts || item.alert || item.notifications;
    
    if (Array.isArray(alerts)) {
      return alerts.filter(a => typeof a === 'string' && a.trim());
    } else if (typeof alerts === 'string') {
      return alerts.split(/[,，;；]/).map(a => a.trim()).filter(a => a);
    }
    
    return [];
  }

  private parseStatus(item: any): ServiceEntry['status'] {
    const status = item.status || item.state;
    
    if (typeof status === 'string') {
      const lower = status.toLowerCase();
      if (lower === 'active' || lower === 'running') return 'active';
      if (lower === 'deprecated' || lower === 'inactive' || lower === 'down') return 'deprecated';
    }
    
    return 'unknown';
  }

  private findLineNumber(lines: string[], item: any, fallbackIndex: number): number {
    const searchTerms = [item.name, item.id, item.service].filter(Boolean);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const term of searchTerms) {
        if (line.includes(String(term))) {
          return i + 1;
        }
      }
    }
    
    return fallbackIndex + 1;
  }

  public getErrors(): ProcessingError[] {
    return this.errors;
  }
}
