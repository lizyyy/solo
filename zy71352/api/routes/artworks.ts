import { Router, Request, Response } from 'express';
import type { RecordStatus } from '../../shared/types.js';
import {
  getArtworkList,
  getArtworkDetail,
  createArtwork,
  updateArtwork,
  updateArtworkStatus,
} from '../services/artworkService.js';
import { getChangeLogsByRecordId } from '../services/changeTrackerService.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, search, page, pageSize } = req.query;

    const result = await getArtworkList({
      status: status as RecordStatus | undefined,
      search: search as string | undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string, 10) : undefined,
    });

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

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const artwork = await getArtworkDetail(id);

    if (!artwork) {
      return res.status(404).json({
        success: false,
        error: 'Artwork not found',
      });
    }

    res.json({
      success: true,
      data: artwork,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const artwork = await createArtwork(req.body);

    res.status(201).json({
      success: true,
      data: artwork,
      message: '作品记录创建成功',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Bad request',
    });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { operator, ...data } = req.body;

    const artwork = await updateArtwork(id, data, operator);

    if (!artwork) {
      return res.status(404).json({
        success: false,
        error: 'Artwork not found',
      });
    }

    res.json({
      success: true,
      data: artwork,
      message: '作品信息更新成功',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Bad request',
    });
  }
});

router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, reason, operator } = req.body;

    const artwork = await updateArtworkStatus(id, status, reason, operator);

    if (!artwork) {
      return res.status(404).json({
        success: false,
        error: 'Artwork not found',
      });
    }

    res.json({
      success: true,
      data: artwork,
      message: '状态更新成功',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Bad request',
    });
  }
});

router.get('/:id/changelog', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const changeLogs = await getChangeLogsByRecordId(id);

    res.json({
      success: true,
      data: changeLogs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;
