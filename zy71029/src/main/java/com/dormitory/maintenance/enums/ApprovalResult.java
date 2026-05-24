package com.dormitory.maintenance.enums;

public enum ApprovalResult {
    PENDING("待审批"),
    APPROVED("通过"),
    REJECTED("拒绝"),
    MODIFIED("修改后通过"),
    EMERGENCY_APPROVED("紧急特批");

    private final String description;

    ApprovalResult(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
