import db from '../database';
import { v4 as uuidv4 } from 'uuid';
import type { FileManifest } from '../types';

export class FileManifestModel {
  static findByTaskId(taskId: string): FileManifest[] {
    return db.prepare('SELECT * FROM file_manifests WHERE taskId = ? ORDER BY createdAt').all(taskId) as FileManifest[];
  }

  static findById(id: string): FileManifest | null {
    return db.prepare('SELECT * FROM file_manifests WHERE id = ?').get(id) as FileManifest || null;
  }

  static create(data: Omit<FileManifest, 'id' | 'createdAt' | 'updatedAt'>): FileManifest {
    const now = Date.now();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO file_manifests (id, taskId, fileName, filePath, fileSize, fileType, checksum, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.taskId,
      data.fileName,
      data.filePath,
      data.fileSize,
      data.fileType,
      data.checksum,
      data.status,
      now,
      now
    );
    return this.findById(id)!;
  }

  static update(id: string, data: Partial<Omit<FileManifest, 'id' | 'createdAt'>>): FileManifest | null {
    const fields = Object.keys(data).filter(k => k !== 'id' && k !== 'createdAt');
    if (fields.length === 0) return this.findById(id);
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => (data as any)[f]);
    values.push(Date.now(), id);
    db.prepare(`UPDATE file_manifests SET ${setClause}, updatedAt = ? WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  static bulkCreate(taskId: string, files: Omit<FileManifest, 'id' | 'taskId' | 'createdAt' | 'updatedAt'>[]): FileManifest[] {
    const now = Date.now();
    const insert = db.prepare(`
      INSERT INTO file_manifests (id, taskId, fileName, filePath, fileSize, fileType, checksum, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const results: FileManifest[] = [];
    for (const file of files) {
      const id = uuidv4();
      insert.run(
        id,
        taskId,
        file.fileName,
        file.filePath,
        file.fileSize,
        file.fileType,
        file.checksum,
        file.status,
        now,
        now
      );
      results.push(this.findById(id)!);
    }
    return results;
  }
}
