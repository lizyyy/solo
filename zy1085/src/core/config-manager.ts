import * as fs from 'fs';
import * as path from 'path';
import { CLIConfig, HistoryRecord } from '../types';
import { ensureDirectory, readJsonFile, writeJsonFile } from '../utils/file-utils';

/**
 * 配置管理器
 * 负责管理本地配置和历史记录
 */
export class ConfigManager {
  private configDir: string;
  private configFile: string;
  private historyFile: string;

  constructor() {
    // 获取用户主目录
    const homeDir = this.getHomeDirectory();
    this.configDir = path.join(homeDir, '.release-plan-cli');
    this.configFile = path.join(this.configDir, 'config.json');
    this.historyFile = path.join(this.configDir, 'history.json');
    
    // 确保配置目录存在
    ensureDirectory(this.configDir);
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig(): CLIConfig {
    return {
      dataDirectory: './release-data',
      outputDirectory: './release-output',
      defaultEnvironment: 'production',
      moduleOwners: {},
      customerList: []
    };
  }

  /**
   * 加载配置
   */
  loadConfig(): CLIConfig {
    if (!fs.existsSync(this.configFile)) {
      const defaultConfig = this.getDefaultConfig();
      this.saveConfig(defaultConfig);
      return defaultConfig;
    }
    
    try {
      const savedConfig = readJsonFile<CLIConfig>(this.configFile);
      // 合并默认配置，确保所有字段都存在
      return { ...this.getDefaultConfig(), ...savedConfig };
    } catch {
      const defaultConfig = this.getDefaultConfig();
      this.saveConfig(defaultConfig);
      return defaultConfig;
    }
  }

  /**
   * 保存配置
   */
  saveConfig(config: CLIConfig): void {
    writeJsonFile(this.configFile, config);
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<CLIConfig>): CLIConfig {
    const currentConfig = this.loadConfig();
    const updatedConfig = { ...currentConfig, ...updates };
    this.saveConfig(updatedConfig);
    return updatedConfig;
  }

  /**
   * 加载历史记录
   */
  loadHistory(): HistoryRecord[] {
    if (!fs.existsSync(this.historyFile)) {
      return [];
    }
    
    try {
      return readJsonFile<HistoryRecord[]>(this.historyFile);
    } catch {
      return [];
    }
  }

  /**
   * 添加历史记录
   */
  addHistory(record: Omit<HistoryRecord, 'id' | 'timestamp'>): HistoryRecord {
    const history = this.loadHistory();
    
    const newRecord: HistoryRecord = {
      id: this.generateHistoryId(),
      timestamp: new Date().toISOString(),
      ...record
    };
    
    // 限制历史记录数量（保留最近100条）
    const maxHistory = 100;
    const updatedHistory = [newRecord, ...history].slice(0, maxHistory);
    
    writeJsonFile(this.historyFile, updatedHistory);
    
    return newRecord;
  }

  /**
   * 清空历史记录
   */
  clearHistory(): void {
    writeJsonFile(this.historyFile, []);
  }

  /**
   * 获取特定版本的历史记录
   */
  getHistoryByVersion(version: string): HistoryRecord[] {
    const history = this.loadHistory();
    return history.filter(record => record.version === version);
  }

  /**
   * 获取最近的历史记录
   */
  getRecentHistory(limit: number = 10): HistoryRecord[] {
    const history = this.loadHistory();
    return history.slice(0, limit);
  }

  /**
   * 获取配置文件路径
   */
  getConfigPath(): string {
    return this.configFile;
  }

  /**
   * 获取历史文件路径
   */
  getHistoryPath(): string {
    return this.historyFile;
  }

  /**
   * 获取用户主目录
   */
  private getHomeDirectory(): string {
    const homeDir = process.env.HOME || 
                    process.env.USERPROFILE ||
                    (process.env.HOMEPATH ? (process.env.HOMEDRIVE || '') + process.env.HOMEPATH : null);
    
    if (!homeDir) {
      // 如果找不到主目录，使用当前目录
      return process.cwd();
    }
    
    return homeDir;
  }

  /**
   * 生成历史记录ID
   */
  private generateHistoryId(): string {
    return `hist-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
