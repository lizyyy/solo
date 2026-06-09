import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { getDb, UPLOADS_DIR } from '../db.js';
import type { Screenshot } from '../../shared/types.js';

interface UploadMeta {
  layerId?: string;
  caption: string;
  standardTags: string[];
  boundVersion?: number;
}

export async function upload(
  taskId: string,
  file: Express.Multer.File,
  meta: UploadMeta,
): Promise<Screenshot> {
  if (!meta.standardTags || !Array.isArray(meta.standardTags) || meta.standardTags.length === 0) {
    throw new Error('standardTags must be a non-empty array');
  }

  const db = await getDb();
  const ext = path.extname(file.originalname) || '.bin';
  const newFileName = `${uuidv4()}${ext}`;
  const storedPath = path.resolve(UPLOADS_DIR, newFileName);

  fs.writeFileSync(storedPath, file.buffer);

  const screenshot: Screenshot = {
    id: uuidv4(),
    taskId,
    layerId: meta.layerId,
    fileName: newFileName,
    storedPath,
    fileSize: file.size,
    mimeType: file.mimetype,
    uploadedAt: new Date().toISOString(),
    caption: meta.caption || '',
    standardTags: meta.standardTags,
    boundVersion: meta.boundVersion,
    isDeleted: false,
  };

  db.data.screenshots.push(screenshot);
  await db.write();
  return screenshot;
}

export async function listByTask(taskId: string): Promise<Screenshot[]> {
  const db = await getDb();
  return db.data.screenshots
    .filter((s) => s.taskId === taskId && !s.isDeleted)
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}

export async function softDelete(id: string): Promise<boolean> {
  const db = await getDb();
  const idx = db.data.screenshots.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  db.data.screenshots[idx] = {
    ...db.data.screenshots[idx],
    isDeleted: true,
  };
  await db.write();
  return true;
}

export async function getDownloadPath(id: string): Promise<string | null> {
  const db = await getDb();
  const shot = db.data.screenshots.find((s) => s.id === id);
  if (!shot || shot.isDeleted) return null;
  return shot.storedPath;
}

export async function getScreenshot(id: string): Promise<Screenshot | null> {
  const db = await getDb();
  const shot = db.data.screenshots.find((s) => s.id === id);
  return shot || null;
}
