import { type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import TrackRepo from '../repositories/TrackRepo.js';
import AuditRepo from '../repositories/AuditRepo.js';
import type { Track, SourceInfo } from '../../shared/types.js';

const trackRepo = new TrackRepo();
const auditRepo = new AuditRepo();

export async function getTracks(req: Request, res: Response): Promise<void> {
  try {
    const { searchKeyword } = req.query;
    let tracks: Track[];

    if (searchKeyword && typeof searchKeyword === 'string') {
      tracks = trackRepo.findByKeyword(searchKeyword);
    } else {
      tracks = trackRepo.findAll();
    }

    res.json({
      success: true,
      data: tracks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取曲目列表失败',
    });
  }
}

export async function getTrack(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const track = trackRepo.findById(id);

    if (!track) {
      res.status(404).json({
        success: false,
        error: '曲目不存在',
      });
      return;
    }

    res.json({
      success: true,
      data: track,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取曲目详情失败',
    });
  }
}

export async function createTrack(req: Request, res: Response): Promise<void> {
  try {
    const { name, artist, duration, staminaLevel, notes } = req.body;

    if (!name || !artist || duration === undefined || staminaLevel === undefined) {
      res.status(400).json({
        success: false,
        error: '缺少必填字段',
      });
      return;
    }

    const source: SourceInfo = {
      sourceType: 'manual',
      importedBy: req.ip || 'unknown',
      importedAt: new Date().toISOString(),
    };

    const track: Omit<Track, 'createdAt' | 'updatedAt'> = {
      id: uuidv4(),
      name,
      artist,
      duration,
      staminaLevel,
      notes,
      source,
    };

    const created = trackRepo.create(track);

    auditRepo.create({
      id: uuidv4(),
      action: 'create',
      entityType: 'track',
      entityId: created.id,
      afterChange: created,
      operator: req.ip || 'unknown',
      ip: req.ip,
    });

    res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建曲目失败',
    });
  }
}

export async function updateTrack(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, artist, duration, staminaLevel, notes } = req.body;

    const existing = trackRepo.findById(id);
    if (!existing) {
      res.status(404).json({
        success: false,
        error: '曲目不存在',
      });
      return;
    }

    const updated = trackRepo.update(id, {
      name,
      artist,
      duration,
      staminaLevel,
      notes,
    });

    if (updated) {
      auditRepo.create({
        id: uuidv4(),
        action: 'update',
        entityType: 'track',
        entityId: id,
        beforeChange: existing,
        afterChange: updated,
        operator: req.ip || 'unknown',
        ip: req.ip,
      });
    }

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新曲目失败',
    });
  }
}

export async function deleteTrack(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const existing = trackRepo.findById(id);
    if (!existing) {
      res.status(404).json({
        success: false,
        error: '曲目不存在',
      });
      return;
    }

    const deleted = trackRepo.delete(id);

    if (deleted) {
      auditRepo.create({
        id: uuidv4(),
        action: 'delete',
        entityType: 'track',
        entityId: id,
        beforeChange: existing,
        operator: req.ip || 'unknown',
        ip: req.ip,
      });
    }

    res.json({
      success: true,
      data: deleted,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除曲目失败',
    });
  }
}
