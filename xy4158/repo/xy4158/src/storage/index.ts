import * as fs from 'fs';
import * as path from 'path';
import { 
  ProjectState, 
  ProjectConfig, 
  ValidationRules, 
  DeviceConfig,
  QuarantineEntry,
  ScannedFile,
  TimelineEntry,
  ValidationIssue
} from '../types';
import { formatDate } from '../utils';

export interface StorageOptions {
  projectDir: string;
}

export class ProjectStorage {
  private options: StorageOptions;
  private state: ProjectState | null = null;

  constructor(options: StorageOptions) {
    this.options = options;
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    const dirs = [
      this.options.projectDir,
      this.getDataDir(),
      this.getQuarantineDir(),
      this.getReportsDir()
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  private getProjectFile(): string {
    return path.join(this.options.projectDir, 'ocv-project.json');
  }

  private getDataDir(): string {
    return path.join(this.options.projectDir, 'data');
  }

  private getQuarantineDir(): string {
    return path.join(this.options.projectDir, 'quarantine');
  }

  private getReportsDir(): string {
    return path.join(this.options.projectDir, 'reports');
  }

  private getQuarantineJsonPath(): string {
    return path.join(this.options.projectDir, 'quarantine.json');
  }

  initProject(name: string, description?: string): ProjectState {
    const defaultRules: ValidationRules = {
      allowedExtensions: ['.csv', '.jpg', '.jpeg', '.png', '.log', '.txt'],
      maxMissingIntervals: 3,
      maxTimeDriftMinutes: 15,
      minFileSize: 10,
      maxDuplicateThreshold: 2,
      requireDeviceIdInFilename: true
    };

    const config: ProjectConfig = {
      name,
      created: formatDate(new Date()),
      description,
      rules: defaultRules,
      devices: []
    };

    this.state = {
      config,
      scannedFiles: [],
      timelineEntries: [],
      issues: [],
      quarantines: []
    };

    this.saveState();
    return this.state;
  }

  loadProject(): ProjectState {
    const projectFile = this.getProjectFile();
    
    if (!fs.existsSync(projectFile)) {
      throw new Error(`项目文件不存在: ${projectFile}`);
    }

    const content = fs.readFileSync(projectFile, 'utf-8');
    this.state = JSON.parse(content) as ProjectState;
    return this.state;
  }

  saveState(): void {
    if (!this.state) return;
    
    const projectFile = this.getProjectFile();
    fs.writeFileSync(projectFile, JSON.stringify(this.state, null, 2), 'utf-8');
    
    this.saveQuarantineJson();
  }

  private saveQuarantineJson(): void {
    if (!this.state) return;
    
    const quarantinePath = this.getQuarantineJsonPath();
    const quarantineData = {
      generatedAt: formatDate(new Date()),
      projectName: this.state.config.name,
      quarantines: this.state.quarantines,
      issues: this.state.issues
    };
    
    fs.writeFileSync(quarantinePath, JSON.stringify(quarantineData, null, 2), 'utf-8');
  }

  projectExists(): boolean {
    return fs.existsSync(this.getProjectFile());
  }

  getState(): ProjectState {
    if (!this.state) {
      throw new Error('项目未加载，请先调用 loadProject() 或 initProject()');
    }
    return this.state;
  }

  updateConfig(config: Partial<ProjectConfig>): void {
    if (!this.state) return;
    
    this.state.config = {
      ...this.state.config,
      ...config
    };
    
    this.saveState();
  }

  addDevice(device: DeviceConfig): void {
    if (!this.state) return;
    
    const existingIndex = this.state.config.devices.findIndex(d => d.id === device.id);
    if (existingIndex >= 0) {
      this.state.config.devices[existingIndex] = device;
    } else {
      this.state.config.devices.push(device);
    }
    
    this.saveState();
  }

  removeDevice(deviceId: string): boolean {
    if (!this.state) return false;
    
    const index = this.state.config.devices.findIndex(d => d.id === deviceId);
    if (index >= 0) {
      this.state.config.devices.splice(index, 1);
      this.saveState();
      return true;
    }
    return false;
  }

  updateScannedFiles(files: ScannedFile[]): void {
    if (!this.state) return;
    
    this.state.scannedFiles = files;
    this.state.lastScanned = formatDate(new Date());
    this.saveState();
  }

  updateTimeline(entries: TimelineEntry[]): void {
    if (!this.state) return;
    
    this.state.timelineEntries = entries;
    this.saveState();
  }

  updateIssues(issues: ValidationIssue[]): void {
    if (!this.state) return;
    
    this.state.issues = issues;
    this.state.lastValidated = formatDate(new Date());
    this.saveState();
  }

  addQuarantine(quarantine: QuarantineEntry): void {
    if (!this.state) return;
    
    const existingIndex = this.state.quarantines.findIndex(
      q => q.fileId === quarantine.fileId && q.issueId === quarantine.issueId
    );
    
    if (existingIndex >= 0) {
      this.state.quarantines[existingIndex] = quarantine;
    } else {
      this.state.quarantines.push(quarantine);
    }
    
    this.saveState();
  }

  getReportPath(filename: string): string {
    return path.join(this.getReportsDir(), filename);
  }

  getExportPath(filename: string): string {
    return path.join(this.options.projectDir, filename);
  }

  async quarantineFile(filePath: string, issueId: string, fileId: string): Promise<string> {
    const quarantineDir = this.getQuarantineDir();
    const fileName = path.basename(filePath);
    const quarantinePath = path.join(quarantineDir, `${issueId}_${fileName}`);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }
    
    fs.copyFileSync(filePath, quarantinePath);
    
    this.addQuarantine({
      issueId,
      fileId,
      action: 'quarantine',
      quarantinePath,
      resolvedAt: formatDate(new Date())
    });
    
    return quarantinePath;
  }

  listQuarantinedFiles(): Array<{ 
    issueId: string; 
    fileId: string; 
    quarantinePath?: string;
    action: string;
  }> {
    if (!this.state) return [];
    return this.state.quarantines.map(q => ({
      issueId: q.issueId,
      fileId: q.fileId,
      quarantinePath: q.quarantinePath,
      action: q.action
    }));
  }

  getStatistics(): {
    totalFiles: number;
    validFiles: number;
    invalidFiles: number;
    totalIssues: number;
    criticalIssues: number;
    quarantinedFiles: number;
    devices: number;
  } {
    if (!this.state) {
      return {
        totalFiles: 0,
        validFiles: 0,
        invalidFiles: 0,
        totalIssues: 0,
        criticalIssues: 0,
        quarantinedFiles: 0,
        devices: 0
      };
    }

    const validFiles = this.state.scannedFiles.filter(f => f.isValid).length;
    const invalidFiles = this.state.scannedFiles.filter(f => !f.isValid).length;
    const criticalIssues = this.state.issues.filter(i => i.severity === 'critical').length;
    const quarantinedFiles = this.state.quarantines.filter(q => q.action === 'quarantine').length;

    return {
      totalFiles: this.state.scannedFiles.length,
      validFiles,
      invalidFiles,
      totalIssues: this.state.issues.length,
      criticalIssues,
      quarantinedFiles,
      devices: this.state.config.devices.length
    };
  }
}
