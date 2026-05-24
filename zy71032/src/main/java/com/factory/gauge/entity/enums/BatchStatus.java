package com.factory.gauge.entity.enums;

public enum BatchStatus {
    NORMAL("正常", "批次生产正常"),
    LOCKED("已锁定", "因量具问题被锁定，待复检"),
    REINSPECTED("已复检", "已完成复检"),
    UNLOCKED("已解锁", "复检通过，批次解锁"),
    CLOSED("已关闭", "批次已结案");

    private final String displayName;
    private final String description;

    BatchStatus(String displayName, String description) {
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
