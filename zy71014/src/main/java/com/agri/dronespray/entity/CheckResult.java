package com.agri.dronespray.entity;

public enum CheckResult {
    PASS("通过", "校验通过"),
    FAIL("不通过", "校验不通过"),
    WARNING("警告", "存在风险但可继续"),
    MANUAL_REVIEW("需人工复核", "需要人工审核判断");

    private final String displayName;
    private final String description;

    CheckResult(String displayName, String description) {
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
