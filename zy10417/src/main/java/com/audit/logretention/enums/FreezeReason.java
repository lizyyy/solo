package com.audit.logretention.enums;

public enum FreezeReason {
    COMPLAINT_INVOLVEMENT("涉及投诉"),
    AUDIT_INVESTIGATION("审计调查"),
    LEGAL_PROCEEDING("法律诉讼"),
    REGULATORY_INQUIRY("监管问询"),
    SECURITY_INCIDENT("安全事件"),
    BUSINESS_AUDIT("业务审计"),
    OTHER("其他原因");

    private final String description;

    FreezeReason(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}