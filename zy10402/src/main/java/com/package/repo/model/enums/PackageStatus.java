package com.package.repo.model.enums;

public enum PackageStatus {
    PUBLISHED("已发布"),
    WITHDRAW_REQUESTED("撤回申请中"),
    WITHDRAW_PENDING_REVIEW("待复核"),
    WITHDRAW_APPROVED("撤回通过"),
    WITHDRAW_REJECTED("撤回被拒绝"),
    WITHDRAW_BLOCKED("撤回被拦截"),
    WITHDRAW_COMPENSATED("已补偿"),
    ERROR("异常状态");

    private final String description;

    PackageStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
