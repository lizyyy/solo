package com.privacy.replay.model;

public enum ReplayRequestStatus {
    PENDING("待审批"),
    APPROVED("已批准"),
    REJECTED("已拒绝"),
    PROCESSING("处理中"),
    COMPLETED("已完成"),
    CANCELLED("已取消"),
    EXPIRED("已过期");

    private final String description;

    ReplayRequestStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
