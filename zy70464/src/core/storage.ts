import * as fs from 'fs';
import * as path from 'path';
import { MeetingMinutes } from '../types';

export interface StorageConfig {
  dataDir: string;
  meetingsFile: string;
}

export class FileStorage {
  private config: StorageConfig;

  constructor(dataDir?: string) {
    const baseDir = dataDir || process.cwd();
    this.config = {
      dataDir: path.join(baseDir, '.mmp-data'),
      meetingsFile: path.join(baseDir, '.mmp-data', 'meetings.json'),
    };
    this.ensureDataDir();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.config.dataDir)) {
      fs.mkdirSync(this.config.dataDir, { recursive: true });
    }
  }

  private readFromFile(): MeetingMinutes[] {
    try {
      if (!fs.existsSync(this.config.meetingsFile)) {
        return [];
      }
      const content = fs.readFileSync(this.config.meetingsFile, 'utf-8');
      return JSON.parse(content) as MeetingMinutes[];
    } catch (error) {
      console.error('读取存储文件失败:', error);
      return [];
    }
  }

  private writeToFile(meetings: MeetingMinutes[]): void {
    try {
      this.ensureDataDir();
      fs.writeFileSync(
        this.config.meetingsFile,
        JSON.stringify(meetings, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('写入存储文件失败:', error);
      throw error;
    }
  }

  loadAllMeetings(): MeetingMinutes[] {
    return this.readFromFile();
  }

  saveMeeting(meeting: MeetingMinutes): void {
    const meetings = this.readFromFile();
    const index = meetings.findIndex((m) => m.id === meeting.id);
    if (index >= 0) {
      meetings[index] = meeting;
    } else {
      meetings.push(meeting);
    }
    this.writeToFile(meetings);
  }

  getMeeting(id: string): MeetingMinutes | undefined {
    const meetings = this.readFromFile();
    return meetings.find((m) => m.id === id);
  }

  deleteMeeting(id: string): boolean {
    const meetings = this.readFromFile();
    const filtered = meetings.filter((m) => m.id !== id);
    if (filtered.length === meetings.length) {
      return false;
    }
    this.writeToFile(filtered);
    return true;
  }

  clearAll(): void {
    this.writeToFile([]);
  }

  getDataDir(): string {
    return this.config.dataDir;
  }
}
