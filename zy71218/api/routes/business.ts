import { Router, type Request, type Response } from 'express';
import { businessService } from '../services/businessService.js';

const router = Router();

const mockUser = {
  id: 'u001',
  name: '张明',
};

router.get('/links', async (req: Request, res: Response): Promise<void> => {
  try {
    const { businessNo } = req.query;

    const graph = await businessService.getLinkGraph(
      businessNo as string | undefined,
    );

    res.json({
      success: true,
      data: graph,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '获取关联图谱失败',
    });
  }
});

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

    const result = await businessService.getBusinessList(page, pageSize, filters);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '获取业务数据列表失败',
    });
  }
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: '业务ID不能为空',
      });
      return;
    }

    const business = await businessService.getBusinessDetail(id);

    if (!business) {
      res.status(404).json({
        success: false,
        error: '业务数据不存在',
      });
      return;
    }

    res.json({
      success: true,
      data: business,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '获取业务详情失败',
    });
  }
});

router.post('/link', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sourceId, sourceType, targetId, targetType, linkType } = req.body;

    if (!sourceId || !sourceType || !targetId || !targetType || !linkType) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数',
      });
      return;
    }

    const link = await businessService.createLink(
      sourceId,
      sourceType,
      targetId,
      targetType,
      linkType,
      mockUser.id,
      mockUser.name,
    );

    res.json({
      success: true,
      data: link,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '建立关联失败',
    });
  }
});

router.delete('/link/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: '关联ID不能为空',
      });
      return;
    }

    const result = await businessService.deleteLink(id);

    if (!result) {
      res.status(404).json({
        success: false,
        error: '关联不存在',
      });
      return;
    }

    res.json({
      success: true,
      data: { message: '删除成功' },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '删除关联失败',
    });
  }
});

export default router;
