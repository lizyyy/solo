package com.portinspector.model;

public enum RiskLevel {
    CRITICAL("critical"),
    HIGH("high"),
    MEDIUM("medium"),
    LOW("low"),
    SAFE("safe");

    private final String value;

    RiskLevel(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static RiskLevel fromValue(String value) {
        for (RiskLevel level : values()) {
            if (level.value.equalsIgnoreCase(value)) {
                return level;
            }
        }
        return SAFE;
    }
}
