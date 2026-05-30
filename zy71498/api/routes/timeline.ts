import express from 'express';
import { getTimelineEvents } from '../store';
import { validateTimelineOrder } from '../utils/conflictDetection';

const router = express.Router();

router.get('/:trackId', (req, res) => {
  try {
    const { trackId } = req.params;
    const timeline = getTimelineEvents(trackId);
    const validation = validateTimelineOrder(timeline);

    res.json({
      events: timeline,
      validation,
    });
  } catch (error) {
    console.error('Failed to get timeline:', error);
    res.status(500).json({ error: 'Failed to get timeline' });
  }
});

export default router;
