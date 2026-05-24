package com.bus.notify.enums;

public enum NotificationStatus {
    PENDING("待发送", "通知等待发送"),
    SENT("已发送", "通知已发送"),
    DELIVERED("已送达", "通知已送达"),
    FAILED("发送失败", "通知发送失败"),
    CONFIRMED("已确认", "乘客已确认收到通知"),
    SKIPPED("已跳过", "因去重或其他原因跳过");

    private final String displayName;
    private final String description;

    NotificationStatus(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getDescription() {
        return description;
    }
}
