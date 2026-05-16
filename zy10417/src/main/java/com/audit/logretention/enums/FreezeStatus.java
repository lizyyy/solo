package com.audit.logretention.enums;

public enum FreezeStatus {
    PENDING_REVIEW("待复核"),
    ACTIVE("已生效"),
    BLOCKED("被拦截"),
    COMPENSATED("已补偿"),
    RELEASED("已释放"),
    CANCELLED("已取消");

    private final String description;

    FreezeStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}