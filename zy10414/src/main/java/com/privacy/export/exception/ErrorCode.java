package com.privacy.export.exception;

public enum ErrorCode {
    INVALID_STATUS_TRANSITION("E001", "无效的状态转换"),
    CONSENT_VERSION_EXPIRED("E002", "同意版本已过期"),
    CONSENT_VERSION_NOT_FOUND("E003", "同意版本不存在"),
    EXPORT_REQUEST_NOT_FOUND("E004", "导出请求不存在"),
    INVALID_SCOPE_CATEGORY("E005", "无效的导出范围类别"),
    SCOPE_VALIDATION_FAILED("E006", "导出范围校验失败"),
    PACKAGING_TASK_EXISTS("E007", "打包任务已存在"),
    DELIVERY_RECORD_EXISTS("E008", "交付记录已存在"),
    APPROVAL_NODE_NOT_FOUND("E009", "审批节点不存在"),
    MANUAL_CORRECTION_REQUIRED("E010", "需要人工修正"),
    REQUEST_ALREADY_COMPLETED("E011", "请求已完成"),
    DUPLICATE_REQUEST_NO("E012", "请求编号重复"),
    VALIDATION_ERROR("E013", "参数校验失败"),
    SYSTEM_ERROR("E999", "系统内部错误");

    private final String code;
    private final String message;

    ErrorCode(String code, String message) {
        this.code = code;
        this.message = message;
    }

    public String getCode() {
        return code;
    }

    public String getMessage() {
        return message;
    }
}
