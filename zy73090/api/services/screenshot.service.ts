import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { getDb, UPLOADS_DIR } from '../db.js';
import type { Screenshot, CadLayer, LayerHistory, LayerStatus } from '../../shared/types.js';

const STATUS_CN: Record<LayerStatus, string> = {
  approved: '通过',
  needs_modify: '需修改',
  rejected: '驳回',
};

interface UploadMeta {
  layerId?: string;
  caption: string;
  standardTags: string[];
  boundVersion?: number;
}

function enrichShot(shot: Screenshot, layers: CadLayer[], histories: LayerHistory[]): Screenshot {
  const enriched: Screenshot = { ...shot };
  if (/^https?:\/\//i.test(shot.storedPath)) {
    enriched.url = shot.storedPath;
  } else {
    enriched.url = `/api/uploads/${shot.fileName}`;
  }
  if (shot.layerId) {
    const layer = layers.find((l) => l.id === shot.layerId);
    if (layer) {
      enriched.layerOriginalName = layer.originalName;
      enriched.layerDisplayName = layer.displayName;
      enriched.layerStatus = STATUS_CN[layer.currentStatus];
      enriched.layerOpinion = layer.latestOpinion;
      const latestNote = [...histories]
        .filter((h) => h.layerId === layer.id && h.note)
        .sort((a, b) => b.version - a.version)[0];
      if (latestNote) enriched.layerNote = latestNote.note;
    }
  }
  return enriched;
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

  const layers = db.data.layers.filter((l: CadLayer) => l.taskId === taskId);
  return enrichShot(screenshot, layers, db.data.histories);
}

export async function listByTask(taskId: string): Promise<Screenshot[]> {
  const db = await getDb();
  const layers = db.data.layers.filter((l: CadLayer) => l.taskId === taskId);
  return db.data.screenshots
    .filter((s) => s.taskId === taskId && !s.isDeleted)
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    .map((s) => enrichShot(s, layers, db.data.histories));
}

export async function softDelete(id: string): Promise<boolean> {
  const dbInst = await getDb();
  const idx = dbInst.data.screenshots.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  dbInst.data.screenshots[idx] = {
    ...dbInst.data.screenshots[idx],
    isDeleted: true,
  };
  await dbInst.write();
  return true;
}

export async function getDownloadPath(id: string): Promise<string | null> {
  const dbInst = await getDb();
  const shot = dbInst.data.screenshots.find((s) => s.id === id);
  if (!shot || shot.isDeleted) return null;
  return shot.storedPath;
}

export async function getScreenshot(id: string): Promise<Screenshot | null> {
  const db = await getDb();
  const shot = db.data.screenshots.find((s) => s.id === id);
  if (!shot) return null;
  const layers = db.data.layers.filter((l: CadLayer) => l.taskId === shot.taskId);
  return enrichShot(shot, layers, db.data.histories);
}
