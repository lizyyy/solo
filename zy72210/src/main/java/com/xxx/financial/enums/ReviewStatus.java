package com.xxx.financial.enums;

public enum ReviewStatus {
    PENDING("待复核"),
    NORMAL("正常流程"),
    PENDING_MANAGER_REVIEW("待客户经理复核"),
    DATA_CONFLICT("数据冲突待确认"),
    CALIBER_ERROR("口径错误"),
    SUPPLEMENT_REQUIRED("需补录"),
    REVIEW_PASSED("复核通过"),
    REVIEW_REJECTED("复核驳回");

    private final String description;

    ReviewStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
