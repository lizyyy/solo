import express from 'express';
import type { Request, Response } from 'express';
import { getDb } from '../db/init.js';
import { MaterialRepository } from '../repositories/MaterialRepository.js';
import { TrackRepository } from '../repositories/TrackRepository.js';
import { ChangeRepository } from '../repositories/ChangeRepository.js';
import { MessageRepository } from '../repositories/MessageRepository.js';
import { SyncService } from '../services/SyncService.js';
import { ConflictService } from '../services/ConflictService.js';
import type { ApiResponse, Conflict, TunerMessage, ConflictStatus } from '../../shared/types.js';

const router = express.Router();

const db = getDb();
const materialRepo = new MaterialRepository(db);
const trackRepo = new TrackRepository(db);
const changeRepo = new ChangeRepository(db);
const messageRepo = new MessageRepository(db);
const syncService = new SyncService(materialRepo, trackRepo, changeRepo);
const conflictService = new ConflictService(materialRepo, messageRepo, syncService);

router.get('/:materialId/messages', async (req: Request, res: Response) => {
  try {
    const { materialId } = req.params;
    const messages = conflictService.getMessages(materialId);

    res.json({
      success: true,
      data: messages
    } as ApiResponse<TunerMessage[]>);
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: e.message
    } as ApiResponse<null>);
  }
});

router.post('/:materialId/messages', async (req: Request, res: Response) => {
  try {
    const { materialId } = req.params;
    const { content, message_date, recorded_by } = req.body;

    if (!content || !message_date) {
      return res.status(400).json({
        success: false,
        error: '留言内容和日期不能为空'
      } as ApiResponse<null>);
    }

    const result = conflictService.addTunerMessage(
      materialId,
      content,
      message_date,
      recorded_by || '许老师'
    );

    res.json({
      success: true,
      data: result,
      message: result.conflicts.length > 0
        ? `检测到${result.conflicts.length}处冲突，请许老师确认`
        : '留言补录成功，未检测到冲突'
    } as ApiResponse<any>);
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: e.message
    } as ApiResponse<null>);
  }
});

router.get('/conflicts', async (req: Request, res: Response) => {
  try {
    const material_id = req.query.materialId as string | undefined;
    const status = req.query.status as ConflictStatus | undefined;
    const conflicts = conflictService.getConflicts(material_id, status);

    res.json({
      success: true,
      data: conflicts
    } as ApiResponse<Conflict[]>);
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: e.message
    } as ApiResponse<null>);
  }
});

router.post('/conflicts/:conflictId/resolve', async (req: Request, res: Response) => {
  try {
    const { conflictId } = req.params;
    const { resolution, resolved_by } = req.body;

    if (!resolution || !['confirmed', 'rejected'].includes(resolution)) {
      return res.status(400).json({
        success: false,
        error: '请选择确认或驳回'
      } as ApiResponse<null>);
    }

    const conflict = await conflictService.resolveConflict(
      conflictId,
      resolution,
      resolved_by || '许老师'
    );

    res.json({
      success: true,
      data: conflict,
      message: resolution === 'confirmed'
        ? '已确认以调音师留言为准，数据已同步更新'
        : '已驳回，保留原授权期限页数据'
    } as ApiResponse<Conflict>);
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: e.message
    } as ApiResponse<null>);
  }
});

router.get('/conflicts/pending/count', async (req: Request, res: Response) => {
  try {
    const count = conflictService.getPendingConflictsCount();
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
