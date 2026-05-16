package com.statuspage.exception;

import lombok.Getter;

@Getter
public enum ErrorCode {
    INCIDENT_NOT_FOUND("INCIDENT_001", "事故不存在"),
    INCIDENT_ALREADY_EXISTS("INCIDENT_002", "事故编号已存在"),
    INVALID_STATUS_TRANSITION("INCIDENT_003", "无效的状态转换"),
    ANNOUNCEMENT_NOT_FOUND("ANNOUNCE_001", "公告不存在"),
    CONFIRMATION_DUPLICATE("CONFIRM_001", "订阅方已确认该公告"),
    SUBSCRIBER_NOT_FOUND("SUBSCRIBER_001", "订阅方不存在"),
    EXCEPTION_LOG_NOT_FOUND("EXCEPTION_001", "异常日志不存在"),
    VALIDATION_ERROR("VALID_001", "参数验证失败"),
    SYSTEM_ERROR("SYSTEM_001", "系统内部错误");

    private final String code;
    private final String message;

    ErrorCode(String code, String message) {
        this.code = code;
        this.message = message;
    }
}