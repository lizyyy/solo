package com.agri.dronespray.entity;

public enum PermissionStatus {
    DRAFT("草稿", "许可申请已创建，待提交"),
    SUBMITTED("已提交", "许可申请已提交，待系统审核"),
    SYSTEM_CHECKING("系统审核中", "系统正在进行各项校验"),
    SYSTEM_APPROVED("系统审核通过", "系统校验全部通过，待人工复核"),
    SYSTEM_REJECTED("系统审核驳回", "系统校验发现问题，需要修正"),
    MANUAL_REVIEWING("人工复核中", "复核人员正在审核"),
    APPROVED("已批准", "许可已批准，可以执行作业"),
    REJECTED("已驳回", "许可申请被驳回"),
    CANCELLED("已取消", "许可申请已取消"),
    AMENDED("已修正", "许可经人工修正后重新生效"),
    COMPLETED("已完成", "作业已完成并提交报告");

    private final String displayName;
    private final String description;

    PermissionStatus(String displayName, String description) {
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
