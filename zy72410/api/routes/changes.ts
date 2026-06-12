import express from 'express';
import type { Request, Response } from 'express';
import { getDb } from '../db/init.js';
import { MaterialRepository } from '../repositories/MaterialRepository.js';
import { TrackRepository } from '../repositories/TrackRepository.js';
import { ChangeRepository } from '../repositories/ChangeRepository.js';
import { SyncService } from '../services/SyncService.js';
import type { ApiResponse, RehearsalChange, HistoryRecord, ChangeTraceNode } from '../../shared/types.js';

const router = express.Router();

const db = getDb();
const materialRepo = new MaterialRepository(db);
const trackRepo = new TrackRepository(db);
const changeRepo = new ChangeRepository(db);
const syncService = new SyncService(materialRepo, trackRepo, changeRepo);

router.get('/', async (req: Request, res: Response) => {
  try {
    const material_id = req.query.materialId as string | undefined;
    let changes: RehearsalChange[];

    if (material_id) {
      changes = changeRepo.findByMaterialId(material_id);
    } else {
      changes = changeRepo.findAll();
    }

    const result = await Promise.all(
      changes.map(async (c) => {
        const material = materialRepo.findById(c.material_id);
        const track = c.track_id ? trackRepo.findById(c.track_id) : null;
        return {
          ...c,
          material_name: material?.material_name || '',
          track_name: track?.track_name || ''
        };
      })
    );

    res.json({
      success: true,
      data: result
    } as ApiResponse<any[]>);
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: e.message
    } as ApiResponse<null>);
  }
});

router.get('/history/:materialId', async (req: Request, res: Response) => {
  try {
    const { materialId } = req.params;
    const track_id = req.query.trackId as string | undefined;

    let history = changeRepo.findHistoryByMaterialId(materialId);
    if (track_id) {
      history = history.filter(h => h.track_id === track_id);
    }

    res.json({
      success: true,
      data: history
    } as ApiResponse<HistoryRecord[]>);
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: e.message
    } as ApiResponse<null>);
  }
});

router.get('/trace/:materialId', async (req: Request, res: Response) => {
  try {
    const { materialId } = req.params;
    const trace = syncService.getChangeTrace(materialId);

    res.json({
      success: true,
      data: trace
    } as ApiResponse<ChangeTraceNode[]>);
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: e.message
    } as ApiResponse<null>);
  }
});

router.get('/count', async (req: Request, res: Response) => {
  try {
    const count = changeRepo.count();
    res.json({
      success: true,
      data: { count }
    } as ApiResponse<{ count: number }>);
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: e.message
    } as ApiResponse<null>);
  }
});

export default router;
