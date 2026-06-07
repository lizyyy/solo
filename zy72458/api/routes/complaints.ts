import { Router } from 'express';
import { complaintService } from '../services/complaintService.js';
import { ApiResponse, ImportComplaintDto } from '../../shared/types.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const complaints = await complaintService.getAll();
    const response: ApiResponse<typeof complaints> = {
      success: true,
      data: complaints,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : '获取投诉列表失败',
    };
    res.status(500).json(response);
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await complaintService.getStats();
    const response: ApiResponse<typeof stats> = {
      success: true,
      data: stats,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : '获取统计数据失败',
    };
    res.status(500).json(response);
  }
});

router.get('/missing-opinion', async (req, res) => {
  try {
    const list = await complaintService.getMissingOpinionList();
    const response: ApiResponse<typeof list> = {
      success: true,
      data: list,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : '获取异常列表失败',
    };
    res.status(500).json(response);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const complaint = await complaintService.getWithAudit(req.params.id);
    if (!complaint) {
      const response: ApiResponse<null> = {
        success: false,
        error: '投诉记录不存在',
      };
      return res.status(404).json(response);
    }
    const response: ApiResponse<typeof complaint> = {
      success: true,
      data: complaint,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : '获取投诉详情失败',
    };
    res.status(500).json(response);
  }
});

router.post('/import', async (req, res) => {
  try {
    const { items, operator } = req.body as { items: ImportComplaintDto[]; operator: string };
    if (!items || !Array.isArray(items)) {
      const response: ApiResponse<null> = {
        success: false,
        error: '导入数据格式错误',
      };
      return res.status(400).json(response);
    }
    const result = await complaintService.importComplaints(items, operator || '阿宁');
    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
      message: `成功导入 ${result.imported.length} 条记录，发现 ${result.duplicates.length} 条重复`,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : '导入失败',
    };
    res.status(500).json(response);
  }
});

router.patch('/:id/photo', async (req, res) => {
  try {
    const { hasPhoto, photoUrl, operator } = req.body;
    const result = await complaintService.updatePhotoInfo(req.params.id, {
      hasPhoto,
      photoUrl,
      operator: operator || '阿宁',
    });
    if (!result) {
      const response: ApiResponse<null> = {
        success: false,
        error: '投诉记录不存在',
      };
      return res.status(404).json(response);
    }
    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
      message: '路口照片信息已更新',
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : '更新失败',
    };
    res.status(500).json(response);
  }
});

router.patch('/:id/opinion', async (req, res) => {
  try {
    const { summary, originalText, operator } = req.body;
    const result = await complaintService.updateResidentOpinion(req.params.id, {
      summary,
      originalText,
      operator: operator || '阿宁',
    });
    if (!result) {
      const response: ApiResponse<null> = {
        success: false,
        error: '投诉记录不存在',
      };
      return res.status(404).json(response);
    }
    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
      message: '居民意见已更新',
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : '更新失败',
    };
    res.status(500).json(response);
  }
});

router.patch('/:id/review', async (req, res) => {
  try {
    const { comment, approve, operator } = req.body;
    const result = await complaintService.reviewBySecretary(req.params.id, {
      comment,
      approve: !!approve,
      operator: operator || '王书记',
    });
    if (!result) {
      const response: ApiResponse<null> = {
        success: false,
        error: '投诉记录不存在',
      };
      return res.status(404).json(response);
    }
    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
      message: '复核完成',
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : '复核失败',
    };
    res.status(500).json(response);
  }
});

export default router;
