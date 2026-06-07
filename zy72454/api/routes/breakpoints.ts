import { Router, Request, Response } from 'express';
import {
  listBreakpoints,
  getBreakpoint,
  updateBreakpoint,
  markConstructionDetour,
  confirmByResident,
} from '../services/breakpointService.js';
import { getBreakpointHistory } from '../services/historyService.js';
import { BreakpointStatus } from '../../shared/types.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { status, hasConstructionDetour, search } = req.query;

  const filters: {
    status?: BreakpointStatus;
    hasConstructionDetour?: boolean;
    search?: string;
  } = {};

  if (status && typeof status === 'string') {
    filters.status = status as BreakpointStatus;
  }
  if (hasConstructionDetour !== undefined) {
    filters.hasConstructionDetour = hasConstructionDetour === 'true' || hasConstructionDetour === '1';
  }
  if (search && typeof search === 'string') {
    filters.search = search;
  }

  const breakpoints = listBreakpoints(filters);
  res.json({ data: breakpoints });
});

router.get('/:id', (req: Request, res: Response) => {
  const bp = getBreakpoint(req.params.id);
  if (!bp) {
    return res.status(404).json({
      error: {
        code: 'BREAKPOINT_NOT_FOUND',
        message: '找不到这个断点记录',
        suggestion: '请检查断点ID是否正确，或返回断点列表重新选择',
      },
    });
  }
  res.json({ data: bp });
});

router.patch('/:id', (req: Request, res: Response) => {
  try {
    const { redlineNote, status, hasConstructionDetour, updatedBy } = req.body;
    const updates: {
      redlineNote?: string;
      status?: BreakpointStatus;
      hasConstructionDetour?: boolean;
    } = {};

    if (redlineNote !== undefined) updates.redlineNote = redlineNote;
    if (status) updates.status = status as BreakpointStatus;
    if (hasConstructionDetour !== undefined)
      updates.hasConstructionDetour = hasConstructionDetour;

    const bp = updateBreakpoint(
      req.params.id,
      updates,
      updatedBy || '市政巡检员-小付'
    );
    res.json({ data: bp });
  } catch (err) {
    const code = (err as { code?: string }).code || 'UNKNOWN_ERROR';
    res.status(400).json({
      error: {
        code,
        message:
          code === 'STATUS_TRANSITION_INVALID'
            ? '当前状态不能直接跳到这个目标状态'
            : code === 'DETOUR_MUST_REVIEW'
              ? '有施工临时改道的断点必须经过居民代表复核'
              : '更新断点信息失败',
        suggestion:
          code === 'STATUS_TRANSITION_INVALID'
            ? '请按照工作流顺序操作：导入→巡检→复核→确认'
            : code === 'DETOUR_MUST_REVIEW'
              ? '请先标记为"待复核"，不要直接归为正常，留给居民代表开会确认'
              : '请稍后重试，或联系系统管理员',
      },
    });
  }
});

router.post('/:id/mark-detour', (req: Request, res: Response) => {
  try {
    const { markedBy } = req.body;
    const bp = markConstructionDetour(
      req.params.id,
      markedBy || '市政巡检员-小付'
    );
    res.json({ data: bp });
  } catch (err) {
    const code = (err as { code?: string }).code || 'UNKNOWN_ERROR';
    res.status(400).json({
      error: {
        code,
        message: '标记施工临时改道失败',
        suggestion: '请确保断点存在且处于可操作状态',
      },
    });
  }
});

router.post('/:id/confirm', (req: Request, res: Response) => {
  try {
    const { confirmedBy } = req.body;
    const bp = confirmByResident(
      req.params.id,
      confirmedBy || '居民代表'
    );
    res.json({ data: bp });
  } catch (err) {
    res.status(400).json({
      error: {
        code: 'CONFIRM_FAILED',
        message: '居民代表确认失败',
        suggestion: '请确保断点处于"待复核"状态',
      },
    });
  }
});

router.get('/:id/history', (req: Request, res: Response) => {
  const history = getBreakpointHistory(req.params.id);
  res.json({ data: history });
});

export default router;
