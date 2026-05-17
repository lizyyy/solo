import { Router, Request, Response } from 'express';
import { correctionService } from '../services/correction';
import { importExportService } from '../services/importExport';
import { memoryStorage } from '../storage/memory';
import {
  ApiResponse,
  ListRequest,
  CorrectionStatus,
  SourceSystem,
  CorrectionStatusLabel
} from '../types';

const router = Router();

router.post('/corrections', async (req: Request, res: Response) => {
  try {
    const result = await correctionService.createCorrection(req.body);

    const response: ApiResponse = {
      code: result.success ? 200 : 400,
      message: result.success ? '创建成功' : '创建失败',
      businessCode: result.businessCode,
      businessMessage: result.businessMessage,
      data: result.record
    };

    res.status(result.success ? 200 : 400).json(response);
  } catch (error) {
    const response: ApiResponse = {
      code: 500,
      message: '服务器内部错误',
      businessCode: 'INTERNAL_ERROR',
      businessMessage: error instanceof Error ? error.message : '未知错误'
    };
    res.status(500).json(response);
  }
});

router.get('/corrections', async (req: Request, res: Response) => {
  try {
    const params: ListRequest = {
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20,
      status: req.query.status as CorrectionStatus | undefined,
      sourceSystem: req.query.sourceSystem as SourceSystem | undefined,
      userId: req.query.userId as string | undefined,
      videoId: req.query.videoId as string | undefined,
      keyword: req.query.keyword as string | undefined
    };

    const result = await memoryStorage.listRecords(params);

    const response: ApiResponse = {
      code: 200,
      message: '查询成功',
      data: result
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      code: 500,
      message: '服务器内部错误',
      businessCode: 'INTERNAL_ERROR',
      businessMessage: error instanceof Error ? error.message : '未知错误'
    };
    res.status(500).json(response);
  }
});

router.get('/corrections/:id', async (req: Request, res: Response) => {
  try {
    const record = await correctionService.getRecordDetail(req.params.id);

    if (!record) {
      const response: ApiResponse = {
        code: 404,
        message: '记录不存在',
        businessCode: 'RECORD_NOT_FOUND',
        businessMessage: '纠偏记录不存在'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      code: 200,
      message: '查询成功',
      data: record
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      code: 500,
      message: '服务器内部错误',
      businessCode: 'INTERNAL_ERROR',
      businessMessage: error instanceof Error ? error.message : '未知错误'
    };
    res.status(500).json(response);
  }
});

router.get('/corrections/:id/history', async (req: Request, res: Response) => {
  try {
    const histories = await memoryStorage.getHistoriesByRecordId(req.params.id);

    const response: ApiResponse = {
      code: 200,
      message: '查询成功',
      data: histories
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      code: 500,
      message: '服务器内部错误',
      businessCode: 'INTERNAL_ERROR',
      businessMessage: error instanceof Error ? error.message : '未知错误'
    };
    res.status(500).json(response);
  }
});

router.put('/corrections/:id/status', async (req: Request, res: Response) => {
  try {
    const result = await correctionService.updateStatus({
      recordId: req.params.id,
      newStatus: req.body.newStatus,
      operatorId: req.body.operatorId,
      operatorName: req.body.operatorName,
      remark: req.body.remark
    });

    const response: ApiResponse = {
      code: result.success ? 200 : 400,
      message: result.success ? '状态更新成功' : '状态更新失败',
      businessCode: result.businessCode,
      businessMessage: result.businessMessage,
      data: result.record
    };

    res.status(result.success ? 200 : 400).json(response);
  } catch (error) {
    const response: ApiResponse = {
      code: 500,
      message: '服务器内部错误',
      businessCode: 'INTERNAL_ERROR',
      businessMessage: error instanceof Error ? error.message : '未知错误'
    };
    res.status(500).json(response);
  }
});

router.post('/corrections/:id/correct-paid', async (req: Request, res: Response) => {
  try {
    const result = await correctionService.correctPaidUser(
      req.params.id,
      req.body.operatorId || 'admin',
      req.body.operatorName || '管理员'
    );

    const response: ApiResponse = {
      code: result.success ? 200 : 400,
      message: result.success ? '纠偏成功' : '纠偏失败',
      businessCode: result.businessCode,
      businessMessage: result.businessMessage,
      data: result.record
    };

    res.status(result.success ? 200 : 400).json(response);
  } catch (error) {
    const response: ApiResponse = {
      code: 500,
      message: '服务器内部错误',
      businessCode: 'INTERNAL_ERROR',
      businessMessage: error instanceof Error ? error.message : '未知错误'
    };
    res.status(500).json(response);
  }
});

router.post('/import', async (req: Request, res: Response) => {
  try {
    const csvContent = req.body.csvContent;
    if (!csvContent) {
      const response: ApiResponse = {
        code: 400,
        message: '请求参数错误',
        businessCode: 'MISSING_CSV_CONTENT',
        businessMessage: '缺少CSV内容'
      };
      return res.status(400).json(response);
    }

    const result = await importExportService.importFromCsv(csvContent);

    const response: ApiResponse = {
      code: 200,
      message: '导入完成',
      data: result
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      code: 500,
      message: '服务器内部错误',
      businessCode: 'INTERNAL_ERROR',
      businessMessage: error instanceof Error ? error.message : '未知错误'
    };
    res.status(500).json(response);
  }
});

router.get('/export', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as CorrectionStatus | undefined;
    const sourceSystem = req.query.sourceSystem as SourceSystem | undefined;

    const csvContent = await importExportService.exportToCsv(status, sourceSystem);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="correction_records_${Date.now()}.csv"`);
    res.send('\uFEFF' + csvContent);
  } catch (error) {
    const response: ApiResponse = {
      code: 500,
      message: '服务器内部错误',
      businessCode: 'INTERNAL_ERROR',
      businessMessage: error instanceof Error ? error.message : '未知错误'
    };
    res.status(500).json(response);
  }
});

router.get('/bad-rows', async (req: Request, res: Response) => {
  try {
    const batchId = req.query.batchId as string | undefined;
    const badRows = await memoryStorage.getBadRows(batchId);

    const response: ApiResponse = {
      code: 200,
      message: '查询成功',
      data: badRows
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      code: 500,
      message: '服务器内部错误',
      businessCode: 'INTERNAL_ERROR',
      businessMessage: error instanceof Error ? error.message : '未知错误'
    };
    res.status(500).json(response);
  }
});

router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const allRecords = await memoryStorage.getAllRecords();
    const statusSummary: Record<string, { count: number; label: string }> = {};

    for (const status of Object.values(CorrectionStatus)) {
      statusSummary[status] = {
        count: allRecords.filter(r => r.status === status).length,
        label: CorrectionStatusLabel[status]
      };
    }

    const sourceSummary: Record<string, number> = {};
    for (const record of allRecords) {
      sourceSummary[record.sourceSystem] = (sourceSummary[record.sourceSystem] || 0) + 1;
    }

    const conflictCount = allRecords.filter(r => r.conflictInfo?.hasConflict).length;

    const response: ApiResponse = {
      code: 200,
      message: '查询成功',
      data: {
        total: allRecords.length,
        statusSummary,
        sourceSummary,
        conflictCount
      }
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      code: 500,
      message: '服务器内部错误',
      businessCode: 'INTERNAL_ERROR',
      businessMessage: error instanceof Error ? error.message : '未知错误'
    };
    res.status(500).json(response);
  }
});

export default router;
