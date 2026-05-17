"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessErrorMessage = exports.BusinessErrorCode = void 0;
exports.createSuccessResponse = createSuccessResponse;
exports.createBusinessErrorResponse = createBusinessErrorResponse;
exports.createErrorResponse = createErrorResponse;
const uuid_1 = require("uuid");
var BusinessErrorCode;
(function (BusinessErrorCode) {
    BusinessErrorCode["SUCCESS"] = "SUCCESS";
    BusinessErrorCode["INVALID_STATUS_TRANSITION"] = "INVALID_STATUS_TRANSITION";
    BusinessErrorCode["IDEMPOTENT_CONFLICT"] = "IDEMPOTENT_CONFLICT";
    BusinessErrorCode["RECORD_NOT_FOUND"] = "RECORD_NOT_FOUND";
    BusinessErrorCode["ALREADY_REVIEWED"] = "ALREADY_REVIEWED";
    BusinessErrorCode["SPLIT_ORDER_BLOCKED"] = "SPLIT_ORDER_BLOCKED";
    BusinessErrorCode["CONCURRENT_CONFLICT"] = "CONCURRENT_CONFLICT";
    BusinessErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
})(BusinessErrorCode || (exports.BusinessErrorCode = BusinessErrorCode = {}));
exports.BusinessErrorMessage = {
    [BusinessErrorCode.SUCCESS]: '操作成功',
    [BusinessErrorCode.INVALID_STATUS_TRANSITION]: '状态流转不合法',
    [BusinessErrorCode.IDEMPOTENT_CONFLICT]: '重复请求，请检查幂等键',
    [BusinessErrorCode.RECORD_NOT_FOUND]: '记录不存在',
    [BusinessErrorCode.ALREADY_REVIEWED]: '该记录已完成复核，请勿重复操作',
    [BusinessErrorCode.SPLIT_ORDER_BLOCKED]: '该用户存在拆单绕开阈值风险，需人工备注后继续',
    [BusinessErrorCode.CONCURRENT_CONFLICT]: '并发冲突，请稍后重试',
    [BusinessErrorCode.VALIDATION_ERROR]: '参数校验失败'
};
function createSuccessResponse(data, message = '操作成功') {
    return {
        success: true,
        code: '200',
        message,
        businessCode: BusinessErrorCode.SUCCESS,
        businessMessage: exports.BusinessErrorMessage[BusinessErrorCode.SUCCESS],
        data,
        timestamp: new Date().toISOString(),
        requestId: (0, uuid_1.v4)()
    };
}
function createBusinessErrorResponse(businessCode, customMessage, data) {
    return {
        success: false,
        code: '400',
        message: '业务处理失败',
        businessCode,
        businessMessage: customMessage || exports.BusinessErrorMessage[businessCode],
        data,
        timestamp: new Date().toISOString(),
        requestId: (0, uuid_1.v4)()
    };
}
function createErrorResponse(code, message, businessCode, businessMessage, data) {
    return {
        success: false,
        code,
        message,
        businessCode,
        businessMessage,
        data,
        timestamp: new Date().toISOString(),
        requestId: (0, uuid_1.v4)()
    };
}
