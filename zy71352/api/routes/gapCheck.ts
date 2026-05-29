import { Router, Request, Response } from 'express';
import { checkGapsForArtwork, checkGapsBatch, resolveAlert } from '../services/gapDetectorService.js';

const router = Router();

router.get('/:artworkId', async (req: Request, res: Response) => {
  try {
    const { artworkId } = req.params;
    const result = await checkGapsForArtwork(artworkId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { artworkIds } = req.query;
    const ids = artworkIds ? (artworkIds as string).split(',') : undefined;

    const results = await checkGapsBatch(ids);

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

router.patch('/alerts/:alertId/resolve', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const alert = await resolveAlert(alertId);

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
    }

    res.json({
      success: true,
      data: alert,
      message: '告警已标记为已解决',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;
