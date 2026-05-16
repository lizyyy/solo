package com.dependency.license.exception;

public class BusinessException extends RuntimeException {
    private final int code;
    private final String originalInput;

    public BusinessException(String message) {
        super(message);
        this.code = 400;
        this.originalInput = null;
    }

    public BusinessException(int code, String message) {
        super(message);
        this.code = code;
        this.originalInput = null;
    }

    public BusinessException(int code, String message, String originalInput) {
        super(message);
        this.code = code;
        this.originalInput = originalInput;
    }

    public int getCode() {
        return code;
    }

    public String getOriginalInput() {
        return originalInput;
    }
}