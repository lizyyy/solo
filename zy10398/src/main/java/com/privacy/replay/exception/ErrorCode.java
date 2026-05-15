package com.privacy.replay.exception;

import lombok.Getter;

@Getter
public enum ErrorCode {

    SUCCESS(0, "成功"),
    PARAM_ERROR(1001, "参数错误"),
    DUPLICATE_REQUEST(1002, "重复请求"),
    BUDGET_NOT_FOUND(2001, "隐私预算不存在"),
    BUDGET_INSUFFICIENT(2002, "隐私预算不足"),
    COUNT_LIMIT_EXCEEDED(2003, "使用次数超限"),
    BUDGET_EXPIRED(2004, "预算已过期"),
    REQUEST_NOT_FOUND(3001, "回放申请不存在"),
    REQUEST_STATUS_INVALID(3002, "申请状态无效"),
    REQUEST_ALREADY_PROCESSED(3003, "申请已处理"),
    SAMPLE_NOT_FOUND(4001, "用户样本不存在"),
    SAMPLE_INACTIVE(4002, "样本已失效"),
    MASKING_LEVEL_NOT_ALLOWED(5001, "脱敏级别不允许"),
    APPROVAL_NOT_REQUIRED(5002, "无需审批"),
    INTERNAL_ERROR(9999, "系统内部错误");

    private final int code;
    private final String message;

    ErrorCode(int code, String message) {
        this.code = code;
        this.message = message;
    }
}
