import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Template, Transaction, PrinterProfiles } from '../types';

export class Parser {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  async loadPrinterProfiles(): Promise<PrinterProfiles> {
    const filePath = path.join(this.basePath, 'printer_profiles.yaml');
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return yaml.load(content) as PrinterProfiles;
  }

  async loadTemplate(templateName: string): Promise<Template> {
    const templatesDir = path.join(this.basePath, 'templates');
    const fileName = templateName.endsWith('.yaml')
      ? templateName
      : `${templateName}.yaml`;
    const filePath = path.join(templatesDir, fileName);
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return yaml.load(content) as Template;
  }

  async loadAllTemplates(): Promise<Map<string, Template>> {
    const templatesDir = path.join(this.basePath, 'templates');
    const templates = new Map<string, Template>();
    
    try {
      const files = await fs.promises.readdir(templatesDir);
      const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
      
      for (const file of yamlFiles) {
        const template = await this.loadTemplate(file);
        const name = file.replace(/\.(yaml|yml)$/, '');
        templates.set(name, template);
      }
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new Error(`Templates directory not found: ${templatesDir}`);
      }
      throw error;
    }
    
    return templates;
  }

  async loadTransactions(): Promise<Transaction[]> {
    const filePath = path.join(this.basePath, 'transactions.jsonl');
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    return lines.map((line, index) => {
      try {
        return JSON.parse(line) as Transaction;
      } catch (error) {
        throw new Error(`Failed to parse transaction at line ${index + 1}: ${line}`);
      }
    });
  }

  async verifyRequiredFiles(): Promise<{ valid: boolean; missing: string[] }> {
    const requiredFiles = [
      path.join(this.basePath, 'printer_profiles.yaml'),
      path.join(this.basePath, 'templates'),
      path.join(this.basePath, 'transactions.jsonl'),
    ];
    
    const missing: string[] = [];
    
    for (const file of requiredFiles) {
      try {
        await fs.promises.access(file);
      } catch {
        missing.push(file);
      }
    }
    
    return {
      valid: missing.length === 0,
      missing,
    };
  }

  resolveVariables(template: Template, data: Record<string, unknown>): Template {
    const resolvedElements = template.elements.map(element => {
      const resolved = { ...element };
      
      if (resolved.content) {
        resolved.content = this.interpolateVariables(resolved.content, data);
      }
      
      if (resolved.barcodeData) {
        resolved.barcodeData = this.interpolateVariables(resolved.barcodeData, data);
      }
      
      if (resolved.qrcodeData) {
        resolved.qrcodeData = this.interpolateVariables(resolved.qrcodeData, data);
      }
      
      return resolved;
    });
    
    return {
      ...template,
      elements: resolvedElements,
    };
  }

  private interpolateVariables(template: string, data: Record<string, unknown>): string {
    return template.replace(/\$\{([^}]+)\}/g, (_, key) => {
      const value = this.getNestedValue(data, key);
      return value !== undefined ? String(value) : '';
    });
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current, key) => {
      if (current && typeof current === 'object' && key in current) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj as unknown);
  }
}
