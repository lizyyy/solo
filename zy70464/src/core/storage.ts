import * as fs from 'fs';
import * as path from 'path';
import { MeetingMinutes } from '../types';

export interface ActionLogEntry {
  type: string;
  description: string;
  timestamp: string;
  meetingId?: string;
}

export interface StorageConfig {
  dataDir: string;
  meetingsFile: string;
  actionLogFile: string;
}

export class FileStorage {
  private config: StorageConfig;

  constructor(dataDir?: string) {
    const baseDir = dataDir || process.cwd();
    this.config = {
      dataDir: path.join(baseDir, '.mmp-data'),
      meetingsFile: path.join(baseDir, '.mmp-data', 'meetings.json'),
      actionLogFile: path.join(baseDir, '.mmp-data', 'action-log.json'),
    };
    this.ensureDataDir();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.config.dataDir)) {
      fs.mkdirSync(this.config.dataDir, { recursive: true });
    }
  }

  private readMeetingsFromFile(): MeetingMinutes[] {
    try {
      if (!fs.existsSync(this.config.meetingsFile)) {
        return [];
      }
      const content = fs.readFileSync(this.config.meetingsFile, 'utf-8');
      return JSON.parse(content) as MeetingMinutes[];
    } catch (error) {
      console.error('读取会议存储文件失败:', error);
      return [];
    }
  }

  private writeMeetingsToFile(meetings: MeetingMinutes[]): void {
    try {
      this.ensureDataDir();
      fs.writeFileSync(
        this.config.meetingsFile,
        JSON.stringify(meetings, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('写入会议存储文件失败:', error);
      throw error;
    }
  }

  private readActionLogFromFile(): ActionLogEntry[] {
    try {
      if (!fs.existsSync(this.config.actionLogFile)) {
        return [];
      }
      const content = fs.readFileSync(this.config.actionLogFile, 'utf-8');
      return JSON.parse(content) as ActionLogEntry[];
    } catch (error) {
      console.error('读取操作日志文件失败:', error);
      return [];
    }
  }

  private writeActionLogToFile(actions: ActionLogEntry[]): void {
    try {
      this.ensureDataDir();
      fs.writeFileSync(
        this.config.actionLogFile,
        JSON.stringify(actions, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('写入操作日志文件失败:', error);
      throw error;
    }
  }

  loadAllMeetings(): MeetingMinutes[] {
    return this.readMeetingsFromFile();
  }

  saveMeeting(meeting: MeetingMinutes): void {
    const meetings = this.readMeetingsFromFile();
    const index = meetings.findIndex((m) => m.id === meeting.id);
    if (index >= 0) {
      meetings[index] = meeting;
    } else {
      meetings.push(meeting);
    }
    this.writeMeetingsToFile(meetings);
  }

  getMeeting(id: string): MeetingMinutes | undefined {
    const meetings = this.readMeetingsFromFile();
    return meetings.find((m) => m.id === id);
  }

  deleteMeeting(id: string): boolean {
    const meetings = this.readMeetingsFromFile();
    const filtered = meetings.filter((m) => m.id !== id);
    if (filtered.length === meetings.length) {
      return false;
    }
    this.writeMeetingsToFile(filtered);
    return true;
  }

  clearAll(): void {
    this.writeMeetingsToFile([]);
    this.writeActionLogToFile([]);
  }

  getDataDir(): string {
    return this.config.dataDir;
  }

  loadAllActions(): ActionLogEntry[] {
    return this.readActionLogFromFile();
  }

  loadActionsByMeetingId(meetingId: string): ActionLogEntry[] {
    const allActions = this.readActionLogFromFile();
    return allActions.filter((a) => a.meetingId === meetingId);
  }

  appendAction(action: ActionLogEntry): void {
    const actions = this.readActionLogFromFile();
    actions.push(action);
    this.writeActionLogToFile(actions);
  }

  appendActions(actions: ActionLogEntry[]): void {
    const existingActions = this.readActionLogFromFile();
    existingActions.push(...actions);
    this.writeActionLogToFile(existingActions);
  }
}
