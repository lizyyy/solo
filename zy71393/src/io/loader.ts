import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { TrackingManifest, EventLog } from '../types';

export class DataLoader {
  static loadManifest(filePath: string): TrackingManifest {
    const content = this.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();

    try {
      let manifest: TrackingManifest;
      
      if (ext === '.yaml' || ext === '.yml') {
        manifest = yaml.load(content) as TrackingManifest;
      } else {
        manifest = JSON.parse(content);
      }

      this.validateManifest(manifest);
      return manifest;
    } catch (error) {
      throw new Error(`加载埋点清单失败: ${(error as Error).message}\n文件路径: ${filePath}`);
    }
  }

  static loadEventLog(filePath: string): EventLog {
    const content = this.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();

    try {
      let eventLog: EventLog;
      
      if (ext === '.yaml' || ext === '.yml') {
        eventLog = yaml.load(content) as EventLog;
      } else {
        eventLog = JSON.parse(content);
      }

      this.validateEventLog(eventLog);
      return eventLog;
    } catch (error) {
      throw new Error(`加载事件日志失败: ${(error as Error).message}\n文件路径: ${filePath}`);
    }
  }

  private static readFile(filePath: string): string {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`读取文件失败: ${(error as Error).message}`);
    }
  }

  private static validateManifest(manifest: TrackingManifest): void {
    if (!manifest.version) {
      throw new Error('缺少必填字段: version');
    }
    if (!manifest.releaseVersion) {
      throw new Error('缺少必填字段: releaseVersion');
    }
    if (!manifest.events || !Array.isArray(manifest.events)) {
      throw new Error('缺少必填字段: events (必须为数组)');
    }

    const eventIds = new Set<string>();
    for (const event of manifest.events) {
      if (!event.id) {
        throw new Error('事件缺少必填字段: id');
      }
      if (!event.name) {
        throw new Error(`事件 ${event.id} 缺少必填字段: name`);
      }
      if (eventIds.has(event.id)) {
        throw new Error(`重复的事件ID: ${event.id}`);
      }
      eventIds.add(event.id);
    }
  }

  private static validateEventLog(eventLog: EventLog): void {
    if (!eventLog.entries || !Array.isArray(eventLog.entries)) {
      throw new Error('缺少必填字段: entries (必须为数组)');
    }

    for (let i = 0; i < eventLog.entries.length; i++) {
      const entry = eventLog.entries[i];
      if (!entry.eventId && !entry.eventName) {
        throw new Error(`日志条目 ${i} 缺少 eventId 或 eventName`);
      }
      if (!entry.timestamp) {
        throw new Error(`日志条目 ${i} 缺少必填字段: timestamp`);
      }
    }
  }
}
