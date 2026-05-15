package com.privacy.replay.model;

public enum MaskingLevel {
    NONE(0, "不脱敏"),
    LOW(1, "低级别脱敏"),
    MEDIUM(2, "中级别脱敏"),
    HIGH(3, "高级别脱敏"),
    FULL(4, "完全脱敏");

    private final int level;
    private final String description;

    MaskingLevel(int level, String description) {
        this.level = level;
        this.description = description;
    }

    public int getLevel() {
        return level;
    }

    public String getDescription() {
        return description;
    }
}
