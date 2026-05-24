package com.factory.gauge.entity.enums;

public enum GaugeStatus {
    NORMAL("正常", "在校准有效期内，可正常使用"),
    EXPIRED("已过期", "超过校准有效期，禁止使用"),
    DEACTIVATED("已停用", "因故障或其他原因停用"),
    CALIBRATING("校准中", "正在校准过程中");

    private final String displayName;
    private final String description;

    GaugeStatus(String displayName, String description) {
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
