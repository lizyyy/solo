import express, { Request, Response } from 'express';
import Joi from 'joi';
import { leaseService } from '../services/leaseService';
import { LeaseStatus } from '../types';
import { createObjectCsvStringifier } from 'csv-writer';

const router = express.Router();

const createLeaseSchema = Joi.object({
  accountName: Joi.string().required().messages({
    'string.base': '账号名称必须是字符串',
    'any.required': '账号名称是必填项'
  }),
  permissionItem: Joi.string().required().messages({
    'string.base': '权限项必须是字符串',
    'any.required': '权限项是必填项'
  }),
  leaseDurationHours: Joi.number().positive().max(720).required().messages({
    'number.base': '租约时长必须是数字',
    'number.positive': '租约时长必须是正数',
    'number.max': '租约时长不能超过720小时',
    'any.required': '租约时长是必填项'
  }),
  applicationReason: Joi.string().min(5).required().messages({
    'string.base': '申请理由必须是字符串',
    'string.min': '申请理由至少5个字符',
    'any.required': '申请理由是必填项'
  }),
  applicant: Joi.string().required().messages({
    'string.base': '申请人必须是字符串',
    'any.required': '申请人是必填项'
  }),
  idempotencyKey: Joi.string().guid().required().messages({
    'string.base': '幂等键必须是字符串',
    'string.guid': '幂等键必须是UUID格式',
    'any.required': '幂等键是必填项'
  })
});

const queryLeasesSchema = Joi.object({
  accountName: Joi.string().optional(),
  status: Joi.string().valid(...Object.values(LeaseStatus)).optional(),
  startTime: Joi.number().optional(),
  endTime: Joi.number().optional(),
  page: Joi.number().positive().optional(),
  pageSize: Joi.number().positive().max(100).optional()
});

const statusAdvanceSchema = Joi.object({
  leaseId: Joi.string().required().messages({
    'string.base': '租约ID必须是字符串',
    'any.required': '租约ID是必填项'
  }),
  targetStatus: Joi.string().valid(...Object.values(LeaseStatus)).required().messages({
    'string.base': '目标状态必须是字符串',
    'any.required': '目标状态是必填项'
  }),
  operator: Joi.string().required().messages({
    'string.base': '操作人必须是字符串',
    'any.required': '操作人是必填项'
  }),
  reason: Joi.string().required().messages({
    'string.base': '原因必须是字符串',
    'any.required': '原因是必填项'
  })
});

const renewalRequestSchema = Joi.object({
  leaseId: Joi.string().required().messages({
    'string.base': '租约ID必须是字符串',
    'any.required': '租约ID是必填项'
  }),
  additionalHours: Joi.number().positive().max(720).required().messages({
    'number.base': '续时时长必须是数字',
    'number.positive': '续时时长必须是正数',
    'number.max': '续时时长不能超过720小时',
    'any.required': '续时时长是必填项'
  }),
  renewalReason: Joi.string().min(5).required().messages({
    'string.base': '续租理由必须是字符串',
    'string.min': '续租理由至少5个字符',
    'any.required': '续租理由是必填项'
  }),
  applicant: Joi.string().required().messages({
    'string.base': '申请人必须是字符串',
    'any.required': '申请人是必填项'
  })
});

const approveRenewalSchema = Joi.object({
  renewalId: Joi.string().required().messages({
    'string.base': '续租ID必须是字符串',
    'any.required': '续租ID是必填项'
  }),
  approver: Joi.string().required().messages({
    'string.base': '审批人必须是字符串',
    'any.required': '审批人是必填项'
  }),
  approved: Joi.boolean().required().messages({
    'boolean.base': '审批结果必须是布尔值',
    'any.required': '审批结果是必填项'
  })
});

const manualCorrectionSchema = Joi.object({
  leaseId: Joi.string().required().messages({
    'string.base': '租约ID必须是字符串',
    'any.required': '租约ID是必填项'
  }),
  updates: Joi.object().required().messages({
    'object.base': '更新内容必须是对象',
    'any.required': '更新内容是必填项'
  }),
  operator: Joi.string().required().messages({
    'string.base': '操作人必须是字符串',
    'any.required': '操作人是必填项'
  }),
  correctionReason: Joi.string().required().messages({
    'string.base': '修正原因必须是字符串',
    'any.required': '修正原因是必填项'
  })
});

const exportSchema = Joi.object({
  accountName: Joi.string().optional(),
  status: Joi.string().valid(...Object.values(LeaseStatus)).optional(),
  startTime: Joi.number().optional(),
  endTime: Joi.number().optional(),
  format: Joi.string().valid('json', 'csv').default('json')
});

function validateRequest(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: any) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '请求参数验证失败',
        details: error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message
        }))
      });
    }
    next();
  };
}

function validateQuery(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: any) => {
    const { error } = schema.validate(req.query, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '查询参数验证失败',
        details: error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message
        }))
      });
    }
    next();
  };
}

router.post('/leases', validateRequest(createLeaseSchema), async (req: Request, res: Response) => {
  try {
    const result = await leaseService.createLease(req.body);
    const statusCode = result.success ? 201 : 500;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message
    });
  }
});

router.get('/leases', validateQuery(queryLeasesSchema), async (req: Request, res: Response) => {
  try {
    const result = await leaseService.queryLeases({
      accountName: req.query.accountName as string,
      status: req.query.status as LeaseStatus,
      startTime: req.query.startTime ? parseInt(req.query.startTime as string) : undefined,
      endTime: req.query.endTime ? parseInt(req.query.endTime as string) : undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined
    });
    const statusCode = result.success ? 200 : 500;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message
    });
  }
});

router.get('/leases/:id', async (req: Request, res: Response) => {
  try {
    const result = await leaseService.getLeaseDetail(req.params.id);
    const statusCode = result.success ? 200 : (result.error === 'LEASE_NOT_FOUND' ? 404 : 500);
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message
    });
  }
});

router.post('/leases/advance-status', validateRequest(statusAdvanceSchema), async (req: Request, res: Response) => {
  try {
    const result = await leaseService.advanceStatus(req.body);
    const statusCode = result.success ? 200 : (result.error === 'LEASE_NOT_FOUND' ? 404 : 400);
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message
    });
  }
});

router.post('/leases/renewal', validateRequest(renewalRequestSchema), async (req: Request, res: Response) => {
  try {
    const result = await leaseService.requestRenewal(req.body);
    const statusCode = result.success ? 201 : (result.error === 'LEASE_NOT_FOUND' ? 404 : 400);
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message
    });
  }
});

router.post('/leases/renewal/approve', validateRequest(approveRenewalSchema), async (req: Request, res: Response) => {
  try {
    const result = await leaseService.approveRenewal(
      req.body.renewalId,
      req.body.approver,
      req.body.approved
    );
    const statusCode = result.success ? 200 : (result.error === 'RENEWAL_NOT_FOUND' ? 404 : 400);
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message
    });
  }
});

router.post('/leases/handle-expired', async (req: Request, res: Response) => {
  try {
    const result = await leaseService.handleExpiredLeases();
    const statusCode = result.success ? 200 : 500;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message
    });
  }
});

router.post('/leases/manual-correction', validateRequest(manualCorrectionSchema), async (req: Request, res: Response) => {
  try {
    const result = await leaseService.manualCorrection(req.body);
    const statusCode = result.success ? 200 : (result.error === 'LEASE_NOT_FOUND' ? 404 : 500);
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message
    });
  }
});

router.get('/leases/export', validateQuery(exportSchema), async (req: Request, res: Response) => {
  try {
    const format = req.query.format as string || 'json';
    const result = await leaseService.exportLeases({
      accountName: req.query.accountName as string,
      status: req.query.status as LeaseStatus,
      startTime: req.query.startTime ? parseInt(req.query.startTime as string) : undefined,
      endTime: req.query.endTime ? parseInt(req.query.endTime as string) : undefined
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    if (!result.data) {
      return res.status(500).json({
        success: false,
        error: 'EXPORT_ERROR',
        message: '导出数据为空'
      });
    }

    if (format === 'csv') {
      const csvStringifier = createObjectCsvStringifier({
        header: [
          { id: 'id', title: 'ID' },
          { id: 'accountName', title: '账号名称' },
          { id: 'permissionItem', title: '权限项' },
          { id: 'leaseStartTime', title: '租约开始时间' },
          { id: 'leaseEndTime', title: '租约结束时间' },
          { id: 'applicationReason', title: '申请理由' },
          { id: 'applicant', title: '申请人' },
          { id: 'status', title: '状态' },
          { id: 'createdAt', title: '创建时间' },
          { id: 'recyclingConclusion', title: '回收结论' },
          { id: 'blockedReason', title: '拦截原因' }
        ]
      });

      const csvData = result.data.map(lease => ({
        ...lease,
        leaseStartTime: new Date(lease.leaseStartTime).toISOString(),
        leaseEndTime: new Date(lease.leaseEndTime).toISOString(),
        createdAt: new Date(lease.createdAt).toISOString()
      }));

      const csvContent = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(csvData);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="leases-export-${Date.now()}.csv"`);
      res.send('\uFEFF' + csvContent);
    } else {
      res.json(result);
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message
    });
  }
});

export default router;
