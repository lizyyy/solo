package com.airport.baggage.common.enums;

public enum ErrorCode {
    MISSING_REQUIRED_FIELD(1001, "缺少必填材料"),
    INVALID_STATUS(1002, "当前状态不允许此操作"),
    DUPLICATE_REQUEST(1003, "重复申请，该旅客近期已领取临赔"),
    REVIEW_REQUIRED(1004, "需要人工复核"),
    AMOUNT_EXCEEDS_LIMIT(1005, "补偿金额超出规则限制"),
    BAGGAGE_NOT_FOUND(2001, "行李记录不存在"),
    COMPENSATION_NOT_FOUND(2002, "补偿单不存在"),
    INVALID_PARAMETER(4000, "参数错误"),
    SYSTEM_ERROR(5000, "系统错误");

    private final int code;
    private final String message;

    ErrorCode(int code, String message) {
        this.code = code;
        this.message = message;
    }

    public int getCode() {
        return code;
    }

    public String getMessage() {
        return message;
    }
}
