import { getDb, saveDb, getNextAudioId } from '../db/database';
import { AudioFile, ReviewRole } from '../types';
import { updateReminderAfterAudioRemark } from './authReminder';

export function addAudioFile(
  fileId: string,
  fileName: string,
  ticketNo: string,
  batchId: string,
  uploadedBy?: string
): AudioFile | null {
  const db = getDb();
  const now = new Date().toISOString();

  try {
    const existingIdx = db.audioFiles.findIndex(a => a.fileId === fileId);
    
    if (existingIdx >= 0) {
      return db.audioFiles[existingIdx];
    }

    const audio: AudioFile = {
      id: getNextAudioId(),
      fileId,
      fileName,
      ticketNo,
      batchId,
      uploadedBy,
      uploadedAt: now
    };

    db.audioFiles.push(audio);

    const ticketIdx = db.tickets.findIndex(t => t.ticketNo === ticketNo);
    if (ticketIdx >= 0) {
      db.tickets[ticketIdx].audioFileId = fileId;
      db.tickets[ticketIdx].updatedAt = now;
    }

    saveDb();
    return audio;
  } catch (error) {
    console.error('添加音频文件失败:', error);
    return null;
  }
}

export function updateAudioRemark(
  ticketId: number,
  remark: string,
  operator?: ReviewRole
): boolean {
  const db = getDb();
  const now = new Date().toISOString();

  try {
    const ticketRow = db.tickets.find(t => t.id === ticketId);
    if (!ticketRow) return false;

    if (ticketRow.audioFileId) {
      const audioIdx = db.audioFiles.findIndex(a => a.fileId === ticketRow.audioFileId);
      if (audioIdx >= 0) {
        db.audioFiles[audioIdx].remark = remark;
        db.audioFiles[audioIdx].verifiedBy = operator;
        db.audioFiles[audioIdx].verifiedAt = now;
      }
    }

    saveDb();
    updateReminderAfterAudioRemark(ticketId, remark);

    return true;
  } catch (error) {
    console.error('更新音频备注失败:', error);
    return false;
  }
}

export function getAudioFileById(fileId: string): AudioFile | null {
  const db = getDb();
  const audio = db.audioFiles.find(a => a.fileId === fileId);
  return audio || null;
}

export function getAudioFilesByBatch(batchId: string): AudioFile[] {
  const db = getDb();
  return db.audioFiles
    .filter(a => a.batchId === batchId)
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}

export function getAudioFilesByTicket(ticketNo: string): AudioFile | null {
  const db = getDb();
  const audio = db.audioFiles.find(a => a.ticketNo === ticketNo);
  return audio || null;
}

export function getAllAudioFiles(): AudioFile[] {
  const db = getDb();
  return [...db.audioFiles]
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}
