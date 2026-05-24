package com.warehouse.charging.enums;

public enum TaskPriority {
    LOW(1),
    MEDIUM(2),
    HIGH(3),
    CRITICAL(4),
    EMERGENCY(5);

    private final int level;

    TaskPriority(int level) {
        this.level = level;
    }

    public int getLevel() {
        return level;
    }
}
