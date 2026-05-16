package com.statuspage.exception;

import lombok.Getter;

@Getter
public class BusinessException extends RuntimeException {
    private final String errorCode;
    private final Object originalInput;

    public BusinessException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
        this.originalInput = null;
    }

    public BusinessException(String errorCode, String message, Object originalInput) {
        super(message);
        this.errorCode = errorCode;
        this.originalInput = originalInput;
    }
}