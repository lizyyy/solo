package com.evidence.exception;

import lombok.Getter;

@Getter
public class BusinessException extends RuntimeException {

    private final String code;
    private final String requestId;

    public BusinessException(String code, String message) {
        super(message);
        this.code = code;
        this.requestId = null;
    }

    public BusinessException(String requestId, String code, String message) {
        super(message);
        this.code = code;
        this.requestId = requestId;
    }

    public static BusinessException notFound(String requestId) {
        return new BusinessException(requestId, "E0001", "证据链不存在");
    }

    public static BusinessException duplicateRequest(String requestId) {
        return new BusinessException(requestId, "E0002", "重复请求");
    }

    public static BusinessException invalidStatusTransition(String requestId, String message) {
        return new BusinessException(requestId, "E0003", message);
    }

    public static BusinessException validationFailed(String message) {
        return new BusinessException("E0004", message);
    }

    public static BusinessException systemError(String message) {
        return new BusinessException("E9999", message);
    }
}
