package com.cityops.batterydispatch.enums;

public enum ErrorCode {
    MISSING_REQUIRED_FIELD(400, "缺材料"),
    INVALID_STATUS(400, "状态不允许"),
    DUPLICATE_REQUEST(409, "重复请求"),
    REVIEW_REQUIRED(409, "需要复核"),
    FORBIDDEN_LOCATION(400, "禁停点无法换电"),
    BATTERY_ALREADY_DISPATCHED(409, "电池已派送"),
    PHOTO_REQUIRED(400, "签收照片缺失"),
    LOW_BATTERY_SKIP(400, "电量高于阈值"),
    RESOURCE_NOT_FOUND(404, "资源不存在"),
    SYSTEM_ERROR(500, "系统错误");

    private final int httpCode;
    private final String message;

    ErrorCode(int httpCode, String message) {
        this.httpCode = httpCode;
        this.message = message;
    }

    public int getHttpCode() {
        return httpCode;
    }

    public String getMessage() {
        return message;
    }
}
