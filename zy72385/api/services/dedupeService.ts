import { db, saveDb } from '../data/db.js';
import type { MaintenanceScreenshot } from '../../shared/types.js';
import crypto from 'crypto';

export async function calculateFileHash(buffer: Buffer): Promise<string> {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function checkDuplicate(fileHash: string, fileName?: string, currentBatchHashes?: string[]) {
  await db.read();
  
  const isCurrentBatchDuplicate = currentBatchHashes?.includes(fileHash) || false;
  
  if (isCurrentBatchDuplicate) {
    const existingInBatch = db.data.screenshots.find((s) => s.fileHash === fileHash);
    return {
      isDuplicate: true,
      duplicateType: 'exact',
      repeatType: 'current_batch',
      existingScreenshot: existingInBatch || null,
      message: `本次导入重复：文件「${fileName}」已在当前批次中上传，不重复计入计算`,
    };
  }
  
  const exactMatch = db.data.screenshots.find((s) => s.fileHash === fileHash);
  if (exactMatch) {
    return {
      isDuplicate: true,
      duplicateType: 'exact',
      repeatType: 'historical',
      existingScreenshot: exactMatch,
      message: `历史重复：文件「${fileName}」已于 ${new Date(exactMatch.uploadTime).toLocaleString('zh-CN')} 由 ${exactMatch.uploader} 上传`,
    };
  }

  if (fileName) {
    const nameMatch = db.data.screenshots.find(
      (s) => s.fileName === fileName && s.status !== 'duplicate'
    );
    if (nameMatch) {
      return {
        isDuplicate: true,
        duplicateType: 'name',
        repeatType: 'historical',
        existingScreenshot: nameMatch,
        message: `历史重复：文件名「${fileName}」已存在，于 ${new Date(nameMatch.uploadTime).toLocaleString('zh-CN')} 由 ${nameMatch.uploader} 上传`,
      };
    }
  }

  return {
    isDuplicate: false,
    duplicateType: null,
    repeatType: 'new',
    existingScreenshot: null,
    message: `新记录：文件「${fileName}」首次导入，已纳入计算`,
  };
}

export async function handleDuplicateUpload(
  duplicateOf: string,
  newFile: { fileName: string; fileHash: string; fileSize: number; uploader: string }
): Promise<MaintenanceScreenshot> {
  await db.read();
  
  const existing = db.data.screenshots.find((s) => s.id === duplicateOf);
  if (!existing) {
    throw new Error('Original screenshot not found');
  }

  const duplicateScreenshot: MaintenanceScreenshot = {
    id: `shot-${crypto.randomUUID().slice(0, 8)}`,
    fileName: newFile.fileName,
    fileHash: newFile.fileHash,
    fileSize: newFile.fileSize,
    uploadTime: new Date().toISOString(),
    uploader: newFile.uploader,
    status: 'duplicate',
    duplicateOf,
    calculationIds: [],
    ocrData: existing.ocrData,
    extractedData: existing.extractedData,
    imageUrl: existing.imageUrl,
  };

  db.data.screenshots.push(duplicateScreenshot);
  await saveDb();

  return duplicateScreenshot;
}

export async function processScreenshot(
  screenshotId: string,
  ocrData: string,
  extractedData: MaintenanceScreenshot['extractedData']
) {
  await db.read();
  
  const screenshot = db.data.screenshots.find((s) => s.id === screenshotId);
  if (!screenshot) {
    throw new Error('Screenshot not found');
  }

  screenshot.ocrData = ocrData;
  screenshot.extractedData = extractedData;
  screenshot.status = 'processed';

  await saveDb();
  return screenshot;
}

export async function getScreenshotById(id: string) {
  await db.read();
  return db.data.screenshots.find((s) => s.id === id);
}

export async function getAllScreenshots() {
  await db.read();
  return [...db.data.screenshots].sort(
    (a, b) => new Date(b.uploadTime).getTime() - new Date(a.uploadTime).getTime()
  );
}

export async function createScreenshot(data: Omit<MaintenanceScreenshot, 'id' | 'uploadTime' | 'calculationIds' | 'status'> & { status?: MaintenanceScreenshot['status'] }) {
  await db.read();
  
  const screenshot: MaintenanceScreenshot = {
    id: `shot-${crypto.randomUUID().slice(0, 8)}`,
    uploadTime: new Date().toISOString(),
    calculationIds: [],
    status: 'pending',
    ...data,
  };

  db.data.screenshots.unshift(screenshot);
  await saveDb();
  return screenshot;
}
