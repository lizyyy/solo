package com.migration.dualwrite.exception;

import lombok.Getter;

@Getter
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
}
