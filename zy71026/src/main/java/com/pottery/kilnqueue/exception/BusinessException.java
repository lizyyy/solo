package com.pottery.kilnqueue.exception;

public class BusinessException extends RuntimeException {
    private final String code;
    private final Object data;

    public BusinessException(String code, String message) {
        super(message);
        this.code = code;
        this.data = null;
    }

    public BusinessException(String code, String message, Object data) {
        super(message);
        this.code = code;
        this.data = data;
    }

    public static BusinessException idempotentConflict(String message, Object existingData) {
        return new BusinessException("IDEMPOTENT_CONFLICT", message, existingData);
    }

    public static BusinessException glazeConflict(String message, Object conflictInfo) {
        return new BusinessException("GLAZE_CONFLICT", message, conflictInfo);
    }

    public static BusinessException sizeExceeded(String message, Object sizeInfo) {
        return new BusinessException("SIZE_EXCEEDED", message, sizeInfo);
    }

    public static BusinessException batchLocked(String message) {
        return new BusinessException("BATCH_LOCKED", message);
    }

    public static BusinessException invalidStatusTransition(String message) {
        return new BusinessException("INVALID_STATUS_TRANSITION", message);
    }

    public static BusinessException notFound(String message) {
        return new BusinessException("NOT_FOUND", message);
    }

    public String getCode() { return code; }
    public Object getData() { return data; }
}
