"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateManualCorrection = exports.validateExceptionHandle = exports.validateStatusTransition = exports.validateQueryRecycle = exports.validateCreateRecycle = void 0;
const joi_1 = __importDefault(require("joi"));
const types_1 = require("../types");
const grayScopeSchema = joi_1.default.object({
    type: joi_1.default.string().valid('percentage', 'tenant_list', 'tag').required(),
    value: joi_1.default.alternatives().try(joi_1.default.number().min(0).max(100), joi_1.default.array().items(joi_1.default.string())).required()
});
const createRecycleSchema = joi_1.default.object({
    configKey: joi_1.default.string().required(),
    grayScope: grayScopeSchema.required(),
    owner: joi_1.default.string().required(),
    recycleDate: joi_1.default.date().iso().required(),
    hitTenants: joi_1.default.array().items(joi_1.default.string()).optional()
});
const queryRecycleSchema = joi_1.default.object({
    configKey: joi_1.default.string().optional(),
    owner: joi_1.default.string().optional(),
    status: joi_1.default.string().valid(...Object.values(types_1.RecycleStatus)).optional(),
    page: joi_1.default.number().min(1).optional(),
    pageSize: joi_1.default.number().min(1).max(100).optional()
});
const statusTransitionSchema = joi_1.default.object({
    status: joi_1.default.string().valid(...Object.values(types_1.RecycleStatus)).required(),
    operator: joi_1.default.string().required(),
    remark: joi_1.default.string().optional()
});
const exceptionHandleSchema = joi_1.default.object({
    handler: joi_1.default.string().required(),
    resolution: joi_1.default.string().required()
});
const manualCorrectionSchema = joi_1.default.object({
    configKey: joi_1.default.string().optional(),
    grayScope: grayScopeSchema.optional(),
    owner: joi_1.default.string().optional(),
    recycleDate: joi_1.default.date().iso().optional(),
    hitTenants: joi_1.default.array().items(joi_1.default.string()).optional(),
    operator: joi_1.default.string().required(),
    reason: joi_1.default.string().required()
});
const validateCreateRecycle = (req, res, next) => {
    const { error } = createRecycleSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }
    next();
};
exports.validateCreateRecycle = validateCreateRecycle;
const validateQueryRecycle = (req, res, next) => {
    const { error } = queryRecycleSchema.validate(req.query);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }
    next();
};
exports.validateQueryRecycle = validateQueryRecycle;
const validateStatusTransition = (req, res, next) => {
    const { error } = statusTransitionSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }
    next();
};
exports.validateStatusTransition = validateStatusTransition;
const validateExceptionHandle = (req, res, next) => {
    const { error } = exceptionHandleSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }
    next();
};
exports.validateExceptionHandle = validateExceptionHandle;
const validateManualCorrection = (req, res, next) => {
    const { error } = manualCorrectionSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }
    next();
};
exports.validateManualCorrection = validateManualCorrection;
