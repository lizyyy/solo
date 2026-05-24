package com.hospital.oxygen.common;

public class BusinessException extends RuntimeException {
    private final int code;
    private final String ruleViolation;

    public BusinessException(String message) {
        super(message);
        this.code = 500;
        this.ruleViolation = null;
    }

    public BusinessException(int code, String message) {
        super(message);
        this.code = code;
        this.ruleViolation = null;
    }

    public BusinessException(int code, String message, String ruleViolation) {
        super(message);
        this.code = code;
        this.ruleViolation = ruleViolation;
    }

    public int getCode() { return code; }
    public String getRuleViolation() { return ruleViolation; }
}
