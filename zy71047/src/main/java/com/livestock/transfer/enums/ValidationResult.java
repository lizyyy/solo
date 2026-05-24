package com.livestock.transfer.enums;

public enum ValidationResult {
    PASS("通过"),
    WARN("警告"),
    FAIL("失败");

    private final String description;

    ValidationResult(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
