"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const ruleVersionService = __importStar(require("../services/ruleVersionService"));
const operationLogService = __importStar(require("../services/operationLogService"));
const router = express_1.default.Router();
function successResponse(res, data, pagination) {
    const response = { success: true, data };
    if (pagination) {
        response.pagination = pagination;
    }
    return res.json(response);
}
function errorResponse(res, message, code = 'BAD_REQUEST', status = 400) {
    return res.status(status).json({
        success: false,
        error: { code, message },
    });
}
router.post('/', async (req, res) => {
    try {
        const { ruleId, ruleName, content, description, createdBy } = req.body;
        if (!ruleId || !ruleName || !content || !createdBy) {
            return errorResponse(res, '缺少必要字段: ruleId, ruleName, content, createdBy');
        }
        const result = await ruleVersionService.createRuleVersion({
            ruleId,
            ruleName,
            content,
            description,
            createdBy,
        });
        return res.status(201).json({ success: true, data: result });
    }
    catch (err) {
        const error = err;
        return errorResponse(res, error.message);
    }
});
router.get('/', async (req, res) => {
    try {
        const { ruleId, status, page = '1', pageSize = '20' } = req.query;
        const pageNum = parseInt(page, 10);
        const pageSizeNum = parseInt(pageSize, 10);
        const result = await ruleVersionService.listRuleVersions(ruleId, {
            page: pageNum,
            pageSize: pageSizeNum,
            status: status,
        });
        const totalPages = Math.ceil(result.total / pageSizeNum);
        return successResponse(res, result.versions, {
            page: pageNum,
            pageSize: pageSizeNum,
            total: result.total,
            totalPages,
        });
    }
    catch (err) {
        const error = err;
        return errorResponse(res, error.message);
    }
});
router.get('/status-info/:status', async (req, res) => {
    try {
        const { status } = req.params;
        const info = ruleVersionService.getRuleVersionStatusInfo(status);
        return successResponse(res, info);
    }
    catch (err) {
        const error = err;
        return errorResponse(res, error.message);
    }
});
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await ruleVersionService.getRuleVersionById(id);
        if (!result) {
            return errorResponse(res, `规则版本不存在: ${id}`, 'NOT_FOUND', 404);
        }
        return successResponse(res, result);
    }
    catch (err) {
        const error = err;
        return errorResponse(res, error.message);
    }
});
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { ruleName, content, description, updatedBy } = req.body;
        if (!updatedBy) {
            return errorResponse(res, '缺少必要字段: updatedBy');
        }
        const result = await ruleVersionService.updateRuleVersion(id, {
            ruleName,
            content,
            description,
            updatedBy,
        });
        return successResponse(res, result);
    }
    catch (err) {
        const error = err;
        return errorResponse(res, error.message);
    }
});
router.post('/:id/submit', async (req, res) => {
    try {
        const { id } = req.params;
        const { operator, comment } = req.body;
        if (!operator) {
            return errorResponse(res, '缺少必要字段: operator');
        }
        const result = await ruleVersionService.submitForApproval(id, {
            operator,
            comment,
        });
        return successResponse(res, result);
    }
    catch (err) {
        const error = err;
        return errorResponse(res, error.message);
    }
});
router.post('/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const { operator, comment } = req.body;
        if (!operator) {
            return errorResponse(res, '缺少必要字段: operator');
        }
        const result = await ruleVersionService.approveRuleVersion(id, {
            operator,
            comment,
        });
        return successResponse(res, result);
    }
    catch (err) {
        const error = err;
        return errorResponse(res, error.message);
    }
});
router.post('/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        const { operator, reason } = req.body;
        if (!operator || !reason) {
            return errorResponse(res, '缺少必要字段: operator, reason');
        }
        const result = await ruleVersionService.rejectRuleVersion(id, {
            operator,
            reason,
        });
        return successResponse(res, result);
    }
    catch (err) {
        const error = err;
        return errorResponse(res, error.message);
    }
});
router.post('/:id/publish', async (req, res) => {
    try {
        const { id } = req.params;
        const { operator, comment } = req.body;
        if (!operator) {
            return errorResponse(res, '缺少必要字段: operator');
        }
        const result = await ruleVersionService.publishRuleVersion(id, {
            operator,
            comment,
        });
        return successResponse(res, result);
    }
    catch (err) {
        const error = err;
        return errorResponse(res, error.message);
    }
});
router.post('/:id/archive', async (req, res) => {
    try {
        const { id } = req.params;
        const { operator, reason } = req.body;
        if (!operator) {
            return errorResponse(res, '缺少必要字段: operator');
        }
        const result = await ruleVersionService.archiveRuleVersion(id, {
            operator,
            reason,
        });
        return successResponse(res, result);
    }
    catch (err) {
        const error = err;
        return errorResponse(res, error.message);
    }
});
router.get('/:id/history', async (req, res) => {
    try {
        const { id } = req.params;
        const { page = '1', pageSize = '20' } = req.query;
        const pageNum = parseInt(page, 10);
        const pageSizeNum = parseInt(pageSize, 10);
        const result = await operationLogService.getEntityHistory('RuleVersion', id, { page: pageNum, pageSize: pageSizeNum });
        const totalPages = Math.ceil(result.total / pageSizeNum);
        return successResponse(res, result.logs, {
            page: pageNum,
            pageSize: pageSizeNum,
            total: result.total,
            totalPages,
        });
    }
    catch (err) {
        const error = err;
        return errorResponse(res, error.message);
    }
});
exports.default = router;
//# sourceMappingURL=ruleVersions.js.map