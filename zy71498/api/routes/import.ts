import express from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import type { Track, ImportBatch, EmotionTag, TimelineEvent } from '../../shared/types';
import {
  getTracks,
  addTrack,
  updateTrack as updateTrackInStore,
  getTrackByTrackId,
  addImportBatch,
  getImportBatches,
} from '../store';
import { detectDuplicateSubmission, detectAllConflicts } from '../utils/conflictDetection';
import { addConflict, addTimelineEvent } from '../store';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

const generateId = () => Math.random().toString(36).substring(2, 11);

const parseEmotionTags = (value: string): EmotionTag[] => {
  if (!value) return [];
  const validTags: EmotionTag[] = ['happy', 'sad', 'energetic', 'calm', 'romantic', 'angry', 'nostalgic', 'hopeful'];
  return value
    .split(/[,，;；\s]+/)
    .map(t => t.trim().toLowerCase() as EmotionTag)
    .filter(t => validTags.includes(t));
};

const parseRowToTrack = (row: any, batchId: string): Track => {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    trackId: String(row.trackId || row['曲目ID'] || row.id || ''),
    title: String(row.title || row['曲名'] || row['歌曲名称'] || ''),
    artist: String(row.artist || row['歌手'] || row['艺术家'] || ''),
    album: String(row.album || row['专辑'] || ''),
    algorithmTags: parseEmotionTags(String(row.algorithmTags || row['算法标签'] || row['算法情绪标签'] || '')),
    manualTags: parseEmotionTags(String(row.manualTags || row['人工标签'] || row['人工情绪标签'] || '')),
    copyrightStatus: (row.copyrightStatus || row['版权状态'] || 'active') === 'removed' ? 'removed' : 'active',
    isRecommended: Boolean(row.isRecommended || row['是否推荐'] || false),
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    importBatchId: batchId,
  };
};

router.post('/', upload.single('file'), (req, res) => {
  try {
    const { file } = req;
    const { operator = '系统' } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    const batchId = `BATCH${String(getImportBatches().length + 1).padStart(3, '0')}`;
    const existingTracks = getTracks();

    const newTracks: Track[] = [];
    const updatedTracks: Track[] = [];
    const unchangedTracks: Track[] = [];
    const changes: any[] = [];

    rows.forEach((row: any) => {
      const parsedTrack = parseRowToTrack(row, batchId);
      if (!parsedTrack.trackId) return;

      const result = detectDuplicateSubmission(parsedTrack, existingTracks);

      if (result.status === 'new') {
        const track = { ...parsedTrack, id: generateId(), createdAt: new Date().toISOString() };
        newTracks.push(track);
        addTrack(track);
        changes.push({ trackId: track.trackId, changeType: 'new', changes: {} });
      } else if (result.status === 'updated' && result.existingTrack) {
        const updated = {
          ...result.existingTrack,
          ...parsedTrack,
          id: result.existingTrack.id,
          createdAt: result.existingTrack.createdAt,
          updatedAt: new Date().toISOString(),
        };
        updatedTracks.push(updated);
        updateTrackInStore(updated);
        changes.push({ trackId: updated.trackId, changeType: 'updated', changes: result.changes });
      } else {
        unchangedTracks.push(result.existingTrack!);
        changes.push({ trackId: result.existingTrack!.trackId, changeType: 'unchanged', changes: {} });
      }
    });

    const batch: ImportBatch = {
      id: batchId,
      fileName: file.originalname,
      importedAt: new Date().toISOString(),
      operator,
      totalCount: rows.length,
      newCount: newTracks.length,
      updatedCount: updatedTracks.length,
      unchangedCount: unchangedTracks.length,
      status: 'completed',
    };
    addImportBatch(batch);

    [...newTracks, ...updatedTracks].forEach(track => {
      const timeline: TimelineEvent[] = [
        {
          id: generateId(),
          trackId: track.id,
          eventType: 'algorithm_tag',
          timestamp: track.createdAt,
          operator: 'algorithm-v2.3',
          description: `算法生成情绪标签: ${track.algorithmTags.join(', ')}`,
        },
      ];
      if (track.manualTags.length > 0) {
        timeline.push({
          id: generateId(),
          trackId: track.id,
          eventType: 'manual_tag' as const,
          timestamp: track.updatedAt,
          operator,
          description: `人工标注情绪标签: ${track.manualTags.join(', ')}`,
        });
      }
      timeline.forEach(e => addTimelineEvent(e));

      const conflicts = detectAllConflicts(track, timeline);
      conflicts.forEach(c => addConflict(c));
    });

    res.json({
      ...batch,
      preview: {
        new: newTracks,
        updated: updatedTracks,
        unchanged: unchangedTracks,
      },
      changes,
    });
  } catch (error) {
    console.error('Failed to import data:', error);
    res.status(500).json({ error: 'Failed to import data' });
  }
});

router.get('/batches', (_req, res) => {
  try {
    const batches = getImportBatches();
    res.json(batches);
  } catch (error) {
    console.error('Failed to get import batches:', error);
    res.status(500).json({ error: 'Failed to get import batches' });
  }
});

export default router;
