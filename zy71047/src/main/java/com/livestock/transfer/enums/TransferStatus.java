package com.livestock.transfer.enums;

public enum TransferStatus {
    DRAFT("草稿"),
    SUBMITTED("已提交"),
    VALIDATING("校验中"),
    VALIDATION_FAILED("校验失败"),
    APPROVED("已核准"),
    IN_TRANSIT("运输中"),
    ACCEPTING("验收中"),
    ACCEPTED("验收通过"),
    ACCEPTANCE_DISPUTE("验收异议"),
    COMPLETED("已完成"),
    CANCELLED("已撤回"),
    MANUALLY_ADJUSTED("人工修正");

    private final String description;

    TransferStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
