package com.encryption.rotation.exception;

import lombok.Getter;

@Getter
public class RotationException extends RuntimeException {
    private final String errorCode;

    public RotationException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public RotationException(String errorCode, String message, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
    }
}
