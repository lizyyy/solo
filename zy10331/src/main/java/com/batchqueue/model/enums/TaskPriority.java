package com.batchqueue.model.enums;

public enum TaskPriority {
    CRITICAL(1, "紧急"),
    HIGH(2, "高"),
    MEDIUM(3, "中"),
    LOW(4, "低");

    private final int level;
    private final String description;

    TaskPriority(int level, String description) {
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
