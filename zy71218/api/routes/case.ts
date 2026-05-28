import { Router, type Request, type Response } from 'express';
import { caseService } from '../services/caseService.js';
import type { CaseStatus } from '../../shared/types.js';

const router = Router();

const mockUser = {
  id: 'u001',
  name: '张明',
};

router.get('/list', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const { status, riskLevel, keyword } = req.query;

    const filters = {
      status: status as string | undefined,
      riskLevel: riskLevel as string | undefined,
      keyword: keyword as string | undefined,
    };

    const result = await caseService.getCaseList(filters, page, pageSize);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '获取案件列表失败',
    });
  }
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: '案件ID不能为空',
      });
      return;
    }

    const caseDetail = await caseService.getCaseDetail(id);

    if (!caseDetail) {
      res.status(404).json({
        success: false,
        error: '案件不存在',
      });
      return;
    }

    res.json({
      success: true,
      data: caseDetail,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '获取案件详情失败',
    });
  }
});

router.post('/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, status, reason } = req.body;

    if (!id || !status) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数',
      });
      return;
    }

    const validStatuses: CaseStatus[] = [
      'pending_confirmation',
      'confirmed',
      'confirmation_failed',
      'normal_repayment',
      'overdue',
      'in_collection',
      'in_negotiation',
      'legal_action',
      'in_repayment',
      'settled',
      'confirmation_withdrawn',
      're_overdue',
    ];

    if (!validStatuses.includes(status as CaseStatus)) {
      res.status(400).json({
        success: false,
        error: '无效的案件状态',
      });
      return;
    }

    await caseService.updateCaseStatus(
      id,
      status as CaseStatus,
      reason || '',
      '',
      '',
      { id: mockUser.id, name: mockUser.name } as any,
    );

    res.json({
      success: true,
      data: { status: 'updated' },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '变更案件状态失败',
    });
  }
});

export default router;
