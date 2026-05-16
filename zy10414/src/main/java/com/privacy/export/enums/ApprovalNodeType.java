package com.privacy.export.enums;

public enum ApprovalNodeType {
    CONSENT_VALIDATION("同意版本校验"),
    LEGAL_REVIEW("法务审批"),
    SCOPE_VALIDATION("导出范围校验"),
    PACKAGING_REVIEW("打包审核"),
    DELIVERY_CONFIRMATION("交付确认");

    private final String description;

    ApprovalNodeType(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
