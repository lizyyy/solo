import express from 'express';
import type { Request, Response } from 'express';
import { getDb } from '../db/init.js';
import { MaterialRepository } from '../repositories/MaterialRepository.js';
import { TrackRepository } from '../repositories/TrackRepository.js';
import { ChangeRepository } from '../repositories/ChangeRepository.js';
import { SyncService } from '../services/SyncService.js';
import type { ApiResponse, Material, Track, MaterialStatus } from '../../shared/types.js';

const router = express.Router();

const db = getDb();
const materialRepo = new MaterialRepository(db);
const trackRepo = new TrackRepository(db);
const changeRepo = new ChangeRepository(db);
const syncService = new SyncService(materialRepo, trackRepo, changeRepo);

router.get('/', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as MaterialStatus | undefined;
    const materials = materialRepo.findAll(status);

    const result = await Promise.all(
      materials.map(async (m) => {
        const tracks = trackRepo.findByMaterialId(m.id);
        return { ...m, tracks };
      })
    );

    res.json({
      success: true,
      data: result
    } as ApiResponse<Array<Material & { tracks: Track[] }>>);
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: e.message
    } as ApiResponse<null>);
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const material = materialRepo.findById(id);
    if (!material) {
      return res.status(404).json({
        success: false,
        error: '素材不存在'
      } as ApiResponse<null>);
    }

    const tracks = trackRepo.findByMaterialId(id);
    const changes = changeRepo.findByMaterialId(id);
    const history = changeRepo.findHistoryByMaterialId(id);

    res.json({
      success: true,
      data: { material, tracks, changes, history }
    } as ApiResponse<any>);
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: e.message
    } as ApiResponse<null>);
  }
});

router.get('/:id/tracks', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tracks = trackRepo.findByMaterialId(id);

    res.json({
      success: true,
      data: tracks
    } as ApiResponse<Track[]>);
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: e.message
    } as ApiResponse<null>);
  }
});

router.put('/tracks/:trackId/remarks', async (req: Request, res: Response) => {
  try {
    const { trackId } = req.params;
    const { remarks, operator, change_reason } = req.body;

    const track = trackRepo.findById(trackId);
    if (!track) {
      return res.status(404).json({
        success: false,
        error: '轨道不存在'
      } as ApiResponse<null>);
    }

    const updatedTrack = await syncService.updateTrackRemarks(
      trackId,
      track.remarks,
      remarks,
      operator || '版权运营',
      change_reason || '更新轨道备注'
    );

    res.json({
      success: true,
      data: updatedTrack,
      message: '轨道备注已更新，排练变更记录和历史记录已同步'
    } as ApiResponse<Track>);
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: e.message
    } as ApiResponse<null>);
  }
});

router.post('/tracks/:trackId/recheck', async (req: Request, res: Response) => {
  try {
    const { trackId } = req.params;
    const { operator } = req.body;

    await syncService.updateTrackReworkChecked(
      trackId,
      operator || '版权运营'
    );

    const track = trackRepo.findById(trackId);
    if (track) {
      const material = materialRepo.findById(track.material_id);
      if (material) {
        const tracks = trackRepo.findByMaterialId(track.material_id);
        const allChecked = tracks.every(t => !t.need_recheck || t.rework_confirmed);
        if (allChecked && material.status === 'rework_pending') {
          materialRepo.updateStatus(track.material_id, 'normal');
        }
      }
    }

    res.json({
      success: true,
      message: '返工原因已复核，数据已同步更新'
    } as ApiResponse<null>);
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: e.message
    } as ApiResponse<null>);
  }
});

router.post('/:id/recalculate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { operator } = req.body;

    await syncService.recalculateAll(id, operator || '版权运营');

    res.json({
      success: true,
      message: '补录后重算完成，所有关联数据已更新'
    } as ApiResponse<null>);
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: e.message
    } as ApiResponse<null>);
  }
});

export default router;
