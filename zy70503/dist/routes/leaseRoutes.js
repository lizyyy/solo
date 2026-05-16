"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const joi_1 = __importDefault(require("joi"));
const leaseService_1 = require("../services/leaseService");
const types_1 = require("../types");
const csv_writer_1 = require("csv-writer");
const router = express_1.default.Router();
const createLeaseSchema = joi_1.default.object({
    accountName: joi_1.default.string().required().messages({
        'string.base': '账号名称必须是字符串',
        'any.required': '账号名称是必填项'
    }),
    permissionItem: joi_1.default.string().required().messages({
        'string.base': '权限项必须是字符串',
        'any.required': '权限项是必填项'
    }),
    leaseDurationHours: joi_1.default.number().positive().max(720).required().messages({
        'number.base': '租约时长必须是数字',
        'number.positive': '租约时长必须是正数',
        'number.max': '租约时长不能超过720小时',
        'any.required': '租约时长是必填项'
    }),
    applicationReason: joi_1.default.string().min(5).required().messages({
        'string.base': '申请理由必须是字符串',
        'string.min': '申请理由至少5个字符',
        'any.required': '申请理由是必填项'
    }),
    applicant: joi_1.default.string().required().messages({
        'string.base': '申请人必须是字符串',
        'any.required': '申请人是必填项'
    }),
    idempotencyKey: joi_1.default.string().guid().required().messages({
        'string.base': '幂等键必须是字符串',
        'string.guid': '幂等键必须是UUID格式',
        'any.required': '幂等键是必填项'
    })
});
const queryLeasesSchema = joi_1.default.object({
    accountName: joi_1.default.string().optional(),
    status: joi_1.default.string().valid(...Object.values(types_1.LeaseStatus)).optional(),
    startTime: joi_1.default.number().optional(),
    endTime: joi_1.default.number().optional(),
    page: joi_1.default.number().positive().optional(),
    pageSize: joi_1.default.number().positive().max(100).optional()
});
const statusAdvanceSchema = joi_1.default.object({
    leaseId: joi_1.default.string().required().messages({
        'string.base': '租约ID必须是字符串',
        'any.required': '租约ID是必填项'
    }),
    targetStatus: joi_1.default.string().valid(...Object.values(types_1.LeaseStatus)).required().messages({
        'string.base': '目标状态必须是字符串',
        'any.required': '目标状态是必填项'
    }),
    operator: joi_1.default.string().required().messages({
        'string.base': '操作人必须是字符串',
        'any.required': '操作人是必填项'
    }),
    reason: joi_1.default.string().required().messages({
        'string.base': '原因必须是字符串',
        'any.required': '原因是必填项'
    })
});
const renewalRequestSchema = joi_1.default.object({
    leaseId: joi_1.default.string().required().messages({
        'string.base': '租约ID必须是字符串',
        'any.required': '租约ID是必填项'
    }),
    additionalHours: joi_1.default.number().positive().max(720).required().messages({
        'number.base': '续时时长必须是数字',
        'number.positive': '续时时长必须是正数',
        'number.max': '续时时长不能超过720小时',
        'any.required': '续时时长是必填项'
    }),
    renewalReason: joi_1.default.string().min(5).required().messages({
        'string.base': '续租理由必须是字符串',
        'string.min': '续租理由至少5个字符',
        'any.required': '续租理由是必填项'
    }),
    applicant: joi_1.default.string().required().messages({
        'string.base': '申请人必须是字符串',
        'any.required': '申请人是必填项'
    })
});
const approveRenewalSchema = joi_1.default.object({
    renewalId: joi_1.default.string().required().messages({
        'string.base': '续租ID必须是字符串',
        'any.required': '续租ID是必填项'
    }),
    approver: joi_1.default.string().required().messages({
        'string.base': '审批人必须是字符串',
        'any.required': '审批人是必填项'
    }),
    approved: joi_1.default.boolean().required().messages({
        'boolean.base': '审批结果必须是布尔值',
        'any.required': '审批结果是必填项'
    })
});
const manualCorrectionSchema = joi_1.default.object({
    leaseId: joi_1.default.string().required().messages({
        'string.base': '租约ID必须是字符串',
        'any.required': '租约ID是必填项'
    }),
    updates: joi_1.default.object().required().messages({
        'object.base': '更新内容必须是对象',
        'any.required': '更新内容是必填项'
    }),
    operator: joi_1.default.string().required().messages({
        'string.base': '操作人必须是字符串',
        'any.required': '操作人是必填项'
    }),
    correctionReason: joi_1.default.string().required().messages({
        'string.base': '修正原因必须是字符串',
        'any.required': '修正原因是必填项'
    })
});
const exportSchema = joi_1.default.object({
    accountName: joi_1.default.string().optional(),
    status: joi_1.default.string().valid(...Object.values(types_1.LeaseStatus)).optional(),
    startTime: joi_1.default.number().optional(),
    endTime: joi_1.default.number().optional(),
    format: joi_1.default.string().valid('json', 'csv').default('json')
});
function validateRequest(schema) {
    return (req, res, next) => {
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
function validateQuery(schema) {
    return (req, res, next) => {
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
router.post('/leases', validateRequest(createLeaseSchema), async (req, res) => {
    try {
        const result = await leaseService_1.leaseService.createLease(req.body);
        const statusCode = result.success ? 201 : 500;
        res.status(statusCode).json(result);
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'INTERNAL_SERVER_ERROR',
            message: error.message
        });
    }
});
router.get('/leases', validateQuery(queryLeasesSchema), async (req, res) => {
    try {
        const result = await leaseService_1.leaseService.queryLeases({
            accountName: req.query.accountName,
            status: req.query.status,
            startTime: req.query.startTime ? parseInt(req.query.startTime) : undefined,
            endTime: req.query.endTime ? parseInt(req.query.endTime) : undefined,
            page: req.query.page ? parseInt(req.query.page) : undefined,
            pageSize: req.query.pageSize ? parseInt(req.query.pageSize) : undefined
        });
        const statusCode = result.success ? 200 : 500;
        res.status(statusCode).json(result);
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'INTERNAL_SERVER_ERROR',
            message: error.message
        });
    }
});
router.get('/leases/export', validateQuery(exportSchema), async (req, res) => {
    try {
        const format = req.query.format || 'json';
        const result = await leaseService_1.leaseService.exportLeases({
            accountName: req.query.accountName,
            status: req.query.status,
            startTime: req.query.startTime ? parseInt(req.query.startTime) : undefined,
            endTime: req.query.endTime ? parseInt(req.query.endTime) : undefined
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
            const csvStringifier = (0, csv_writer_1.createObjectCsvStringifier)({
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
        }
        else {
            res.json(result);
        }
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'INTERNAL_SERVER_ERROR',
            message: error.message
        });
    }
});
router.post('/leases/advance-status', validateRequest(statusAdvanceSchema), async (req, res) => {
    try {
        const result = await leaseService_1.leaseService.advanceStatus(req.body);
        const statusCode = result.success ? 200 : (result.error === 'LEASE_NOT_FOUND' ? 404 : 400);
        res.status(statusCode).json(result);
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'INTERNAL_SERVER_ERROR',
            message: error.message
        });
    }
});
router.post('/leases/renewal', validateRequest(renewalRequestSchema), async (req, res) => {
    try {
        const result = await leaseService_1.leaseService.requestRenewal(req.body);
        const statusCode = result.success ? 201 : (result.error === 'LEASE_NOT_FOUND' ? 404 : 400);
        res.status(statusCode).json(result);
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'INTERNAL_SERVER_ERROR',
            message: error.message
        });
    }
});
router.post('/leases/renewal/approve', validateRequest(approveRenewalSchema), async (req, res) => {
    try {
        const result = await leaseService_1.leaseService.approveRenewal(req.body.renewalId, req.body.approver, req.body.approved);
        const statusCode = result.success ? 200 : (result.error === 'RENEWAL_NOT_FOUND' ? 404 : 400);
        res.status(statusCode).json(result);
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'INTERNAL_SERVER_ERROR',
            message: error.message
        });
    }
});
router.post('/leases/handle-expired', async (req, res) => {
    try {
        const result = await leaseService_1.leaseService.handleExpiredLeases();
        const statusCode = result.success ? 200 : 500;
        res.status(statusCode).json(result);
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'INTERNAL_SERVER_ERROR',
            message: error.message
        });
    }
});
router.post('/leases/manual-correction', validateRequest(manualCorrectionSchema), async (req, res) => {
    try {
        const result = await leaseService_1.leaseService.manualCorrection(req.body);
        const statusCode = result.success ? 200 : (result.error === 'LEASE_NOT_FOUND' ? 404 : 500);
        res.status(statusCode).json(result);
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'INTERNAL_SERVER_ERROR',
            message: error.message
        });
    }
});
router.get('/leases/:id', async (req, res) => {
    try {
        const result = await leaseService_1.leaseService.getLeaseDetail(req.params.id);
        const statusCode = result.success ? 200 : (result.error === 'LEASE_NOT_FOUND' ? 404 : 500);
        res.status(statusCode).json(result);
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'INTERNAL_SERVER_ERROR',
            message: error.message
        });
    }
});
exports.default = router;
//# sourceMappingURL=leaseRoutes.js.map