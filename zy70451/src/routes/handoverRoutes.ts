import express, { Request, Response } from 'express';
import { handoverService } from '../services/handoverService';
import {
  CreateHandoverFormRequest,
  ManualFixRequest,
  AddMaterialSummaryRequest,
  ApiResponse
} from '../types';

const router = express.Router();

router.post('/', (req: Request, res: Response) => {
  try {
    const request: CreateHandoverFormRequest = req.body;
    const requiredFields = ['tenantId', 'tenantName', 'handler', 'serviceRecords'];
    const missingFields = requiredFields.filter(f => !(f in request));

    if (missingFields.length > 0) {
      const response: ApiResponse = {
        code: 400,
        message: '缺少必填字段',
        errors: missingFields.map(f => `字段 ${f} 不能为空`)
      };
      return res.status(400).json(response);
    }

    if (!Array.isArray(request.serviceRecords) || request.serviceRecords.length === 0) {
      const response: ApiResponse = {
        code: 400,
        message: 'serviceRecords 必须是非空数组'
      };
      return res.status(400).json(response);
    }

    const form = handoverService.createHandoverForm(request);
    const response: ApiResponse = {
      code: 200,
      message: '交接单创建成功',
      data: form
    };
    res.status(200).json(response);
  } catch (error) {
    const response: ApiResponse = {
      code: 500,
      message: '创建交接单失败',
      errors: [error instanceof Error ? error.message : '未知错误']
    };
    res.status(500).json(response);
  }
});

router.get('/', (req: Request, res: Response) => {
  try {
    const forms = handoverService.getAllHandoverForms();
    const response: ApiResponse = {
      code: 200,
      message: '获取交接单列表成功',
      data: forms
    };
    res.status(200).json(response);
  } catch (error) {
    const response: ApiResponse = {
      code: 500,
      message: '获取交接单列表失败',
      errors: [error instanceof Error ? error.message : '未知错误']
    };
    res.status(500).json(response);
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const form = handoverService.getHandoverForm(id);

    if (!form) {
      const response: ApiResponse = {
        code: 404,
        message: `交接单不存在: ${id}`
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      code: 200,
      message: '获取交接单成功',
      data: form
    };
    res.status(200).json(response);
  } catch (error) {
    const response: ApiResponse = {
      code: 500,
      message: '获取交接单失败',
      errors: [error instanceof Error ? error.message : '未知错误']
    };
    res.status(500).json(response);
  }
});

router.post('/:id/process', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const form = handoverService.processHandoverForm(id);

    const response: ApiResponse = {
      code: 200,
      message: '交接单处理成功',
      data: form
    };
    res.status(200).json(response);
  } catch (error) {
    const response: ApiResponse = {
      code: 400,
      message: '处理交接单失败',
      errors: [error instanceof Error ? error.message : '未知错误']
    };
    res.status(400).json(response);
  }
});

router.post('/:id/manual-fix', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const request: ManualFixRequest = req.body;

    const requiredFields = ['serviceRecordId', 'manualConclusion', 'remark', 'operator'];
    const missingFields = requiredFields.filter(f => !(f in request));

    if (missingFields.length > 0) {
      const response: ApiResponse = {
        code: 400,
        message: '缺少必填字段',
        errors: missingFields.map(f => `字段 ${f} 不能为空`)
      };
      return res.status(400).json(response);
    }

    const form = handoverService.manualFix(id, request);
    const response: ApiResponse = {
      code: 200,
      message: '人工修正成功',
      data: form
    };
    res.status(200).json(response);
  } catch (error) {
    const response: ApiResponse = {
      code: 400,
      message: '人工修正失败',
      errors: [error instanceof Error ? error.message : '未知错误']
    };
    res.status(400).json(response);
  }
});

router.post('/:id/material-summary', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const request: AddMaterialSummaryRequest = req.body;

    const requiredFields = ['serviceRecordId', 'type', 'content'];
    const missingFields = requiredFields.filter(f => !(f in request));

    if (missingFields.length > 0) {
      const response: ApiResponse = {
        code: 400,
        message: '缺少必填字段',
        errors: missingFields.map(f => `字段 ${f} 不能为空`)
      };
      return res.status(400).json(response);
    }

    const form = handoverService.addMaterialSummary(
      id,
      request.serviceRecordId,
      request.type,
      request.content
    );

    const response: ApiResponse = {
      code: 200,
      message: '添加材料摘要成功',
      data: form
    };
    res.status(200).json(response);
  } catch (error) {
    const response: ApiResponse = {
      code: 400,
      message: '添加材料摘要失败',
      errors: [error instanceof Error ? error.message : '未知错误']
    };
    res.status(400).json(response);
  }
});

router.get('/history/all', (req: Request, res: Response) => {
  try {
    const history = handoverService.getAllHistory();
    const response: ApiResponse = {
      code: 200,
      message: '获取历史记录成功',
      data: history
    };
    res.status(200).json(response);
  } catch (error) {
    const response: ApiResponse = {
      code: 500,
      message: '获取历史记录失败',
      errors: [error instanceof Error ? error.message : '未知错误']
    };
    res.status(500).json(response);
  }
});

router.get('/history/query', (req: Request, res: Response) => {
  try {
    const { resourceRange } = req.query;

    if (!resourceRange || typeof resourceRange !== 'string') {
      const response: ApiResponse = {
        code: 400,
        message: 'resourceRange 参数必填'
      };
      return res.status(400).json(response);
    }

    const history = handoverService.getHistoryByResourceRange(resourceRange);
    const response: ApiResponse = {
      code: 200,
      message: '查询历史记录成功',
      data: history
    };
    res.status(200).json(response);
  } catch (error) {
    const response: ApiResponse = {
      code: 500,
      message: '查询历史记录失败',
      errors: [error instanceof Error ? error.message : '未知错误']
    };
    res.status(500).json(response);
  }
});

export default router;
