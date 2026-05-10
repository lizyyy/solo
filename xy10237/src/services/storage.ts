import * as fs from 'fs';
import * as path from 'path';
import { Sample, CountryRule, CheckHistory, CheckResult } from '../types';

export class StorageService {
  private dataDir: string;
  private samplesDir: string;
  private rulesDir: string;
  private historyDir: string;
  private exportDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.samplesDir = path.join(dataDir, 'samples');
    this.rulesDir = path.join(dataDir, 'rules');
    this.historyDir = path.join(dataDir, 'history');
    this.exportDir = path.join(dataDir, 'exports');
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    [this.dataDir, this.samplesDir, this.rulesDir, this.historyDir, this.exportDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  saveSample(sample: Sample): void {
    const filePath = path.join(this.samplesDir, `${sample.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(sample, null, 2), 'utf-8');
  }

  getSample(id: string): Sample | null {
    const filePath = path.join(this.samplesDir, `${id}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  getSampleByName(name: string): Sample | null {
    const samples = this.getAllSamples();
    return samples.find(s => s.name === name) || null;
  }

  getAllSamples(): Sample[] {
    if (!fs.existsSync(this.samplesDir)) return [];
    return fs.readdirSync(this.samplesDir)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(this.samplesDir, f), 'utf-8')))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  saveRule(rule: CountryRule): void {
    const filePath = path.join(this.rulesDir, `${rule.countryCode}.json`);
    fs.writeFileSync(filePath, JSON.stringify(rule, null, 2), 'utf-8');
  }

  getRule(countryCode: string): CountryRule | null {
    const filePath = path.join(this.rulesDir, `${countryCode.toUpperCase()}.json`);
    if (!fs.existsSync(filePath)) {
      const lowerPath = path.join(this.rulesDir, `${countryCode.toLowerCase()}.json`);
      if (!fs.existsSync(lowerPath)) return null;
      return JSON.parse(fs.readFileSync(lowerPath, 'utf-8'));
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  getAllRules(): CountryRule[] {
    if (!fs.existsSync(this.rulesDir)) return [];
    return fs.readdirSync(this.rulesDir)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(this.rulesDir, f), 'utf-8')));
  }

  saveCheckResult(result: CheckResult): void {
    const historyFile = path.join(this.historyDir, `${result.sampleId}.json`);
    let history: CheckHistory;
    
    if (fs.existsSync(historyFile)) {
      history = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
    } else {
      history = { sampleId: result.sampleId, results: [] };
    }
    
    history.results.push(result);
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), 'utf-8');
  }

  getHistory(sampleId: string): CheckHistory | null {
    const filePath = path.join(this.historyDir, `${sampleId}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  getAllHistory(): CheckHistory[] {
    if (!fs.existsSync(this.historyDir)) return [];
    return fs.readdirSync(this.historyDir)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(this.historyDir, f), 'utf-8')));
  }

  getLastCheckResult(sampleId: string): CheckResult | null {
    const history = this.getHistory(sampleId);
    if (!history || history.results.length === 0) return null;
    return history.results[history.results.length - 1];
  }

  exportToJson(data: any, filename: string): string {
    const filePath = path.join(this.exportDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return filePath;
  }

  exportToCSV(data: any[], filename: string): string {
    if (data.length === 0) {
      const filePath = path.join(this.exportDir, filename);
      fs.writeFileSync(filePath, '', 'utf-8');
      return filePath;
    }
    
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(row => 
        headers.map(h => {
          const val = row[h];
          if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val ?? '';
        }).join(',')
      )
    ].join('\n');
    
    const filePath = path.join(this.exportDir, filename);
    fs.writeFileSync(filePath, csv, 'utf-8');
    return filePath;
  }

  getDataDir(): string {
    return this.dataDir;
  }

  getExportDir(): string {
    return this.exportDir;
  }
}
