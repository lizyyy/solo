import fs from 'fs-extra';
import path from 'path';
import mime from 'mime-types';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database';
import { FileEntry } from '../types';

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.markdown', '.json', '.xml', '.yaml', '.yml',
  '.html', '.htm', '.css', '.js', '.ts', '.tsx', '.jsx',
  '.csv', '.log', '.ini', '.cfg', '.conf',
  '.doc', '.docx', '.rtf', '.odt',
]);

const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.svg',
  '.heic', '.raw',
]);

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm',
  '.m4v', '.3gp',
]);

const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a',
]);

const PDF_EXTENSION = '.pdf';

const SKIP_PATTERNS = [
  /^\./,
  /^node_modules$/,
  /^__pycache__$/,
  /^dist$/,
  /^build$/,
  /^.git$/,
  /^.svn$/,
  /^.hg$/,
  /^.DS_Store$/,
  /^Thumbs\.db$/,
];

export class FileScanner {
  scanFolder(projectId: string, folderPath: string): FileEntry[] {
    const files: FileEntry[] = [];
    this.scanDirectory(projectId, folderPath, folderPath, files);
    return files;
  }

  private scanDirectory(
    projectId: string,
    basePath: string,
    currentPath: string,
    files: FileEntry[]
  ): void {
    const entries = fs.readdirSync(currentPath);
    
    for (const entry of entries) {
      if (this.shouldSkip(entry)) continue;
      
      const fullPath = path.join(currentPath, entry);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        this.scanDirectory(projectId, basePath, fullPath, files);
      } else {
        const fileEntry = this.createFileEntry(projectId, fullPath, stat);
        if (fileEntry) {
          files.push(fileEntry);
        }
      }
    }
  }

  private shouldSkip(name: string): boolean {
    return SKIP_PATTERNS.some(pattern => pattern.test(name));
  }

  private createFileEntry(
    projectId: string,
    filePath: string,
    stat: fs.Stats
  ): FileEntry | null {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);
    
    const fileType = this.getFileType(ext);
    const mimeType = mime.lookup(filePath) || undefined;
    
    const db = getDatabase();
    
    const existing = db.prepare(
      'SELECT id FROM files WHERE project_id = ? AND file_path = ?'
    ).get(projectId, filePath);
    
    if (existing) {
      db.prepare(`
        UPDATE files SET 
          file_name = ?,
          file_size = ?,
          mime_type = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(fileName, stat.size, mimeType, existing.id);
      
      return this.mapRowToFileEntry(
        db.prepare('SELECT * FROM files WHERE id = ?').get(existing.id)
      );
    }
    
    const id = uuidv4();
    
    db.prepare(`
      INSERT INTO files (
        id, project_id, file_name, file_path, file_type, 
        file_size, mime_type, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(id, projectId, fileName, filePath, fileType, stat.size, mimeType);
    
    return this.mapRowToFileEntry(
      db.prepare('SELECT * FROM files WHERE id = ?').get(id)
    );
  }

  private getFileType(ext: string): FileEntry['fileType'] {
    if (TEXT_EXTENSIONS.has(ext)) return 'text';
    if (IMAGE_EXTENSIONS.has(ext)) return 'image';
    if (VIDEO_EXTENSIONS.has(ext)) return 'video';
    if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
    if (ext === PDF_EXTENSION) return 'pdf';
    return 'other';
  }

  private mapRowToFileEntry(row: any): FileEntry {
    return {
      id: row.id,
      projectId: row.project_id,
      fileName: row.file_name,
      filePath: row.file_path,
      fileType: row.file_type as FileEntry['fileType'],
      fileSize: row.file_size,
      mimeType: row.mime_type,
      status: row.status as FileEntry['status'],
      sensitiveCount: row.sensitive_count,
      confirmedCount: row.confirmed_count,
      ignoredCount: row.ignored_count,
      maskOutputPath: row.mask_output_path,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
