package com.hazardous.waste.exception;

import com.hazardous.waste.enums.ErrorCode;

public class BusinessException extends RuntimeException {
    private ErrorCode errorCode;
    private String detail;

    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
        this.detail = null;
    }

    public BusinessException(ErrorCode errorCode, String detail) {
        super(errorCode.getMessage() + ": " + detail);
        this.errorCode = errorCode;
        this.detail = detail;
    }

    public ErrorCode getErrorCode() { return errorCode; }
    public String getDetail() { return detail; }
}
