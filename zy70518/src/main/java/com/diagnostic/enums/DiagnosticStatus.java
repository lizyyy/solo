package com.diagnostic.enums;

public enum DiagnosticStatus {
    PENDING("待处理"),
    CONFIRMED("已确认"),
    BLOCKED("被拦截"),
    REVOKED("已撤销"),
    COMPENSATED("已补偿");

    private final String description;

    DiagnosticStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}