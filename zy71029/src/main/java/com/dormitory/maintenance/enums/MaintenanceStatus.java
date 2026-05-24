package com.dormitory.maintenance.enums;

public enum MaintenanceStatus {
    PENDING_SUBMIT("待提交"),
    PENDING_APPROVAL("待审批"),
    APPROVED("已批准"),
    REJECTED("已拒绝"),
    IN_PROGRESS("施工中"),
    COMPLETED("已完成"),
    CANCELLED("已取消"),
    ABNORMAL("异常");

    private final String description;

    MaintenanceStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
