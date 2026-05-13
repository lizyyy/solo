package com.version.adapter.exception;

public class VersionAdapterException extends RuntimeException {

    private final String errorCode;

    public VersionAdapterException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public VersionAdapterException(String errorCode, String message, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
    }

    public String getErrorCode() {
        return errorCode;
    }
}
