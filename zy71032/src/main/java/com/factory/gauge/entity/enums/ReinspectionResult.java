package com.factory.gauge.entity.enums;

public enum ReinspectionResult {
    PASSED("复检通过", "产品质量合格"),
    FAILED("复检不合格", "产品质量不合格"),
    CONDITIONAL_PASS("有条件通过", "需跟踪后续批次");

    private final String displayName;
    private final String description;

    ReinspectionResult(String displayName, String description) {
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
