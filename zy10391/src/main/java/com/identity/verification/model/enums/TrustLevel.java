package com.identity.verification.model.enums;

public enum TrustLevel {
    VERY_LOW(10, "极低可信"),
    LOW(30, "低可信"),
    MEDIUM(50, "中等可信"),
    HIGH(70, "高可信"),
    VERY_HIGH(90, "极高可信");

    private final int score;
    private final String description;

    TrustLevel(int score, String description) {
        this.score = score;
        this.description = description;
    }

    public int getScore() {
        return score;
    }

    public String getDescription() {
        return description;
    }

    public static TrustLevel fromScore(int score) {
        if (score <= 10) return VERY_LOW;
        if (score <= 30) return LOW;
        if (score <= 50) return MEDIUM;
        if (score <= 70) return HIGH;
        return VERY_HIGH;
    }
}
