package com.cityops.batterydispatch.enums;

public enum DispatchStatus {
    PENDING("待派送"),
    DISPATCHED("已派送"),
    ARRIVED("已到达"),
    FORBIDDEN_LOCATION("禁停点拦截"),
    LOW_BATTERY_SKIP("电量不足跳过"),
    PHOTO_MISSING("签收照片缺失"),
    CONFIRM_REQUIRED("需人工复核"),
    COMPLETED("已完成"),
    CANCELLED("已取消");

    private final String description;

    DispatchStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
