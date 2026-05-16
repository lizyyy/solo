package com.package.repo.model.enums;

public enum ArbitrationResult {
    PENDING("待仲裁"),
    APPROVED("同意撤回"),
    REJECTED("拒绝撤回"),
    NEEDS_MORE_INFO("需补充信息"),
    AUTO_APPROVED("自动通过"),
    AUTO_BLOCKED("自动拦截");

    private final String description;

    ArbitrationResult(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
