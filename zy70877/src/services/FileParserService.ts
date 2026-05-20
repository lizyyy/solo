import * as csv from 'csv-parser';
import { Readable } from 'stream';
import { Mentor, Application, TransferRecord } from '../types';
import { dataStore } from '../store/DataStore';

export class FileParserService {
  async parseMentorCSV(buffer: Buffer): Promise<Mentor[]> {
    const mentors: Mentor[] = [];
    
    return new Promise((resolve, reject) => {
      const readable = Readable.from(buffer.toString('utf-8'));
      
      readable
        .pipe(csv({
          headers: ['id', 'name', 'department', 'major', 'direction', 'quota', 'usedQuota'],
          skipLines: 1
        }))
        .on('data', (row) => {
          mentors.push({
            id: row.id?.trim() || dataStore.generateId(),
            name: row.name?.trim() || '',
            department: row.department?.trim() || '',
            major: row.major?.trim() || '',
            direction: row.direction?.trim() || '',
            quota: parseInt(row.quota) || 0,
            usedQuota: parseInt(row.usedQuota) || 0
          });
        })
        .on('end', () => resolve(mentors))
        .on('error', reject);
    });
  }

  parseApplicationsJSON(jsonString: string): Application[] {
    const data = JSON.parse(jsonString);
    const applications = Array.isArray(data) ? data : [data];
    
    return applications.map((app: any) => ({
      id: app.id?.trim() || dataStore.generateId(),
      batchId: app.batchId?.trim() || '',
      studentId: app.studentId?.trim() || '',
      studentName: app.studentName?.trim() || '',
      studentMajor: app.studentMajor?.trim() || '',
      mentorId: app.mentorId?.trim() || '',
      mentorName: app.mentorName?.trim() || '',
      priority: parseInt(app.priority) || 1,
      isTransfer: Boolean(app.isTransfer),
      status: app.status || 'pending',
      createdAt: app.createdAt ? new Date(app.createdAt) : new Date()
    }));
  }

  parseTransfersJSON(jsonString: string): TransferRecord[] {
    const data = JSON.parse(jsonString);
    const transfers = Array.isArray(data) ? data : [data];
    
    return transfers.map((t: any) => ({
      id: t.id?.trim() || dataStore.generateId(),
      batchId: t.batchId?.trim() || '',
      studentId: t.studentId?.trim() || '',
      studentName: t.studentName?.trim() || '',
      fromMajor: t.fromMajor?.trim() || '',
      toMajor: t.toMajor?.trim() || '',
      reason: t.reason?.trim() || '',
      status: t.status || 'pending',
      createdAt: t.createdAt ? new Date(t.createdAt) : new Date()
    }));
  }

  formatMentorCSV(): string {
    const mentors = dataStore.getAllMentors();
    const headers = ['ID', '姓名', '院系', '专业', '研究方向', '总名额', '已用名额'];
    const rows = mentors.map(m => [
      m.id,
      m.name,
      m.department,
      m.major,
      m.direction,
      m.quota,
      m.usedQuota
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

export const fileParserService = new FileParserService();
