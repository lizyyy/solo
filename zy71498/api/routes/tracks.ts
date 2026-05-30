import express from 'express';
import type { EmotionTag, TimelineEvent } from '../../shared/types';
import {
  getTracks,
  getTrackById,
  updateTrack as updateTrackInStore,
  getTimelineEvents,
  getConflictsByTrackId,
  addTimelineEvent,
} from '../store';

const router = express.Router();

const generateId = () => Math.random().toString(36).substring(2, 11);

router.get('/', (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const hasConflict = req.query.hasConflict;
    const status = req.query.status as string;

    let tracks = getTracks();

    if (hasConflict !== undefined) {
      const conflictTrackIds = new Set(
        tracks
          .filter(t => t.algorithmTags.join(',') !== t.manualTags.join(',') ||
            (t.copyrightStatus === 'removed' && t.isRecommended))
          .map(t => t.id)
      );
      if (hasConflict === 'true') {
        tracks = tracks.filter(t => conflictTrackIds.has(t.id));
      } else {
        tracks = tracks.filter(t => !conflictTrackIds.has(t.id));
      }
    }

    if (status) {
      tracks = tracks.filter(t => t.status === status);
    }

    const total = tracks.length;
    const start = (page - 1) * pageSize;
    const data = tracks.slice(start, start + pageSize);

    res.json({ data, total, page, pageSize });
  } catch (error) {
    console.error('Failed to get tracks:', error);
    res.status(500).json({ error: 'Failed to get tracks' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const track = getTrackById(id);

    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }

    const timeline = getTimelineEvents(id);
    const conflicts = getConflictsByTrackId(id);

    res.json({ ...track, timeline, conflicts });
  } catch (error) {
    console.error('Failed to get track detail:', error);
    res.status(500).json({ error: 'Failed to get track detail' });
  }
});

router.post('/:id/manual-tag', (req, res) => {
  try {
    const { id } = req.params;
    const { tags, note, operator } = req.body as {
      tags: EmotionTag[];
      note: string;
      operator: string;
    };

    const track = getTrackById(id);
    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }

    const updatedTrack = {
      ...track,
      manualTags: tags,
      updatedAt: new Date().toISOString(),
      status: 'active' as const,
    };

    updateTrackInStore(updatedTrack);

    const event: TimelineEvent = {
      id: generateId(),
      trackId: id,
      eventType: 'manual_tag',
      timestamp: new Date().toISOString(),
      operator,
      description: `人工更新情绪标签: ${tags.join(', ')}`,
      evidence: note,
    };
    addTimelineEvent(event);

    res.json({ success: true, track: updatedTrack });
  } catch (error) {
    console.error('Failed to update manual tag:', error);
    res.status(500).json({ error: 'Failed to update manual tag' });
  }
});

export default router;
