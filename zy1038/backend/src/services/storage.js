import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '../../data');

export class StorageService {
  constructor() {
    this.dataDir = dataDir;
  }

  async ensureDataDir() {
    try {
      await fs.access(this.dataDir);
    } catch {
      await fs.mkdir(this.dataDir, { recursive: true });
    }
  }

  async readFile(fileName) {
    await this.ensureDataDir();
    const filePath = path.join(this.dataDir, fileName);
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  async writeFile(fileName, data) {
    await this.ensureDataDir();
    const filePath = path.join(this.dataDir, fileName);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  async getUsers() {
    return this.readFile('users.json');
  }

  async saveUsers(users) {
    return this.writeFile('users.json', users);
  }

  async getSegments() {
    return this.readFile('segments.json');
  }

  async saveSegments(segments) {
    return this.writeFile('segments.json', segments);
  }

  async getFlags() {
    return this.readFile('flags.json');
  }

  async saveFlags(flags) {
    return this.writeFile('flags.json', flags);
  }

  async getAuditLogs() {
    return this.readFile('audit.json');
  }

  async saveAuditLogs(logs) {
    return this.writeFile('audit.json', logs);
  }

  async exportAll() {
    const [users, segments, flags, audit] = await Promise.all([
      this.getUsers(),
      this.getSegments(),
      this.getFlags(),
      this.getAuditLogs()
    ]);

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      users,
      segments,
      flags,
      audit
    };
  }

  async importAll(data) {
    if (data.users) await this.saveUsers(data.users);
    if (data.segments) await this.saveSegments(data.segments);
    if (data.flags) await this.saveFlags(data.flags);
    if (data.audit) await this.saveAuditLogs(data.audit);
  }
}

export const storageService = new StorageService();
