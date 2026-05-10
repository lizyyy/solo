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
const waiveService = __importStar(require("../services/falsePositiveWaiveService"));
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
        const { ruleVersionId, batchId, reason, waivedBy, affectedRows } = req.body;
        if (!ruleVersionId || !batchId || !reason || !waivedBy) {
            return errorResponse(res, '缺少必要字段: ruleVersionId, batchId, reason, waivedBy');
        }
        const result = await waiveService.createFalsePositiveWaive({
            ruleVersionId,
            batchId,
            reason,
            waivedBy,
            affectedRows,
        });
        return res.status(201).json({ success: true, data: result });
    }
    catch (err) {
        const error = err;
        return errorResponse(res, error.message);
    }
});
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await waiveService.getWaiveById(id);
        if (!result) {
            return errorResponse(res, `误报豁免不存在: ${id}`, 'NOT_FOUND', 404);
        }
        return successResponse(res, result);
    }
    catch (err) {
        const error = err;
        return errorResponse(res, error.message);
    }
});
router.get('/rule-version/:ruleVersionId', async (req, res) => {
    try {
        const { ruleVersionId } = req.params;
        const { page = '1', pageSize = '20' } = req.query;
        const pageNum = parseInt(page, 10);
        const pageSizeNum = parseInt(pageSize, 10);
        const result = await waiveService.listWaivesByRuleVersion(ruleVersionId, { page: pageNum, pageSize: pageSizeNum });
        const totalPages = Math.ceil(result.total / pageSizeNum);
        return successResponse(res, result.waives, {
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
router.get('/batch/:batchId', async (req, res) => {
    try {
        const { batchId } = req.params;
        const result = await waiveService.listWaivesByBatch(batchId);
        return successResponse(res, result);
    }
    catch (err) {
        const error = err;
        return errorResponse(res, error.message);
    }
});
exports.default = router;
//# sourceMappingURL=waives.js.map