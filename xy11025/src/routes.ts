import { Router, Request, Response } from 'express';
import { returnBucketService } from './service';
import { exportService } from './export';
import {
  ReturnBucketCreateRequest,
  ReturnBucketBatchCreateRequest,
  ApiResponse,
  ExportQueryParams,
  ReturnBucketStatus
} from './types';

const router = Router();

router.post('/single', (req: Request, res: Response) => {
  try {
    const request: ReturnBucketCreateRequest = req.body;
    const result = returnBucketService.createSingleRecord(request);

    const response: ApiResponse = {
      success: result.validation.valid,
      data: result.record,
      message: result.validation.message,
      validationResult: result.validation
    };

    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      message: `处理失败: ${error.message}`
    };
    res.status(500).json(response);
  }
});

router.post('/batch', (req: Request, res: Response) => {
  try {
    const request: ReturnBucketBatchCreateRequest = req.body;
    const result = returnBucketService.batchCreateRecords(
      request.records,
      request.batchNo
    );

    const hasErrors = result.failed.length > 0;
    const response: ApiResponse = {
      success: !hasErrors,
      data: {
        successful: result.successful,
        failed: result.failed,
        totalCount: request.records.length,
        successCount: result.successful.length,
        failCount: result.failed.length
      },
      message: hasErrors
        ? `批量处理完成，成功 ${result.successful.length} 条，失败 ${result.failed.length} 条`
        : `批量处理完成，共 ${result.successful.length} 条记录`,
      validationResult: {
        valid: !hasErrors,
        hasDuplicateBucket: result.validationResults.some(v => v.hasDuplicateBucket),
        ledgerConsistent: result.validationResults.every(v => v.ledgerConsistent),
        requiredMaterials: [],
        message: hasErrors ? '部分记录校验不通过' : '全部记录校验通过'
      }
    };

    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      message: `批量处理失败: ${error.message}`
    };
    res.status(500).json(response);
  }
});

router.post('/validate', (req: Request, res: Response) => {
  try {
    const request: ReturnBucketCreateRequest = req.body;
    const validation = returnBucketService.validateRecord(request);

    const response: ApiResponse = {
      success: validation.valid,
      data: null,
      message: validation.message,
      validationResult: validation
    };

    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      message: `校验失败: ${error.message}`
    };
    res.status(500).json(response);
  }
});

router.patch('/:id/status', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, operatorId, operatorName, rejectReason, supplementRemark } = req.body;

    const updated = returnBucketService.updateRecordStatus(
      id,
      status as ReturnBucketStatus,
      operatorId,
      operatorName,
      rejectReason,
      supplementRemark
    );

    if (!updated) {
      const response: ApiResponse = {
        success: false,
        message: '记录不存在'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: updated,
      message: '状态更新成功'
    };

    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      message: `更新失败: ${error.message}`
    };
    res.status(500).json(response);
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const record = returnBucketService.getRecord(id);

    if (!record) {
      const response: ApiResponse = {
        success: false,
        message: '记录不存在'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: record,
      message: '查询成功'
    };

    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      message: `查询失败: ${error.message}`
    };
    res.status(500).json(response);
  }
});

router.get('/', (req: Request, res: Response) => {
  try {
    const records = returnBucketService.getAllRecords();

    const response: ApiResponse = {
      success: true,
      data: records,
      message: `查询成功，共 ${records.length} 条记录`
    };

    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      message: `查询失败: ${error.message}`
    };
    res.status(500).json(response);
  }
});

router.get('/export/data', (req: Request, res: Response) => {
  try {
    const params: ExportQueryParams = req.query;
    const data = exportService.getExportData(params);

    const response: ApiResponse = {
      success: true,
      data,
      message: `导出数据查询成功，共 ${data.summary.total} 条记录`
    };

    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      message: `导出数据查询失败: ${error.message}`
    };
    res.status(500).json(response);
  }
});

router.post('/export/csv', async (req: Request, res: Response) => {
  try {
    const params: ExportQueryParams = req.body;
    const filePath = await exportService.exportToCsv(params);

    const response: ApiResponse = {
      success: true,
      data: { filePath },
      message: `CSV文件导出成功，路径: ${filePath}`
    };

    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      message: `CSV导出失败: ${error.message}`
    };
    res.status(500).json(response);
  }
});

export default router;
