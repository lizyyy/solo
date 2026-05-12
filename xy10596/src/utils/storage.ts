import * as fs from 'fs';
import * as path from 'path';
import { ProjectState, SurveyRecord, QuotaUsage } from '../types';

const DATA_DIR = path.join(process.cwd(), '.data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

export class Storage {
  private static ensureDirs(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
  }

  static exists(): boolean {
    return fs.existsSync(STATE_FILE);
  }

  static load(): ProjectState {
    if (!this.exists()) {
      throw new Error('项目未初始化，请先运行 init 命令');
    }
    const content = fs.readFileSync(STATE_FILE, 'utf-8');
    return JSON.parse(content);
  }

  static save(state: ProjectState): void {
    this.ensureDirs();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `state-${timestamp}.json`);
    
    if (fs.existsSync(STATE_FILE)) {
      fs.copyFileSync(STATE_FILE, backupFile);
    }
    
    state.lastUpdatedAt = new Date().toISOString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  }

  static initialize(state: ProjectState): void {
    this.ensureDirs();
    
    if (fs.existsSync(STATE_FILE)) {
      throw new Error('项目已存在，如需重新初始化请先清理数据');
    }
    
    this.save(state);
  }

  static clear(): void {
    if (fs.existsSync(DATA_DIR)) {
      fs.rmSync(DATA_DIR, { recursive: true, force: true });
    }
  }

  static getDataDir(): string {
    return DATA_DIR;
  }

  static getBackupDir(): string {
    return BACKUP_DIR;
  }

  static listBackups(): string[] {
    if (!fs.existsSync(BACKUP_DIR)) return [];
    return fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();
  }

  static restoreBackup(backupName: string): void {
    const backupFile = path.join(BACKUP_DIR, backupName);
    if (!fs.existsSync(backupFile)) {
      throw new Error(`备份文件不存在: ${backupName}`);
    }
    fs.copyFileSync(backupFile, STATE_FILE);
  }
}
