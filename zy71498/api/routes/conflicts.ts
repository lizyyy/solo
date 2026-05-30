import express from 'express';
import { getConflicts, updateConflict as updateConflictInStore } from '../store';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const resolved = req.query.resolved;
    const conflictType = req.query.conflictType as string;
    const trackId = req.query.trackId as string;

    let conflicts = getConflicts();

    if (resolved !== undefined) {
      conflicts = conflicts.filter(c => c.resolved === (resolved === 'true'));
    }

    if (conflictType) {
      conflicts = conflicts.filter(c => c.conflictType === conflictType);
    }

    if (trackId) {
      conflicts = conflicts.filter(c => c.trackId === trackId);
    }

    res.json(conflicts);
  } catch (error) {
    console.error('Failed to get conflicts:', error);
    res.status(500).json({ error: 'Failed to get conflicts' });
  }
});

router.post('/:id/resolve', (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionNote, operator } = req.body as {
      resolutionNote: string;
      operator: string;
    };

    const conflicts = getConflicts();
    const conflict = conflicts.find(c => c.id === id);

    if (!conflict) {
      return res.status(404).json({ error: 'Conflict not found' });
    }

    const updatedConflict = {
      ...conflict,
      resolved: true,
      resolvedAt: new Date().toISOString(),
      resolver: operator,
      resolutionNote,
    };

    updateConflictInStore(updatedConflict);
    res.json(updatedConflict);
  } catch (error) {
    console.error('Failed to resolve conflict:', error);
    res.status(500).json({ error: 'Failed to resolve conflict' });
  }
});

export default router;
