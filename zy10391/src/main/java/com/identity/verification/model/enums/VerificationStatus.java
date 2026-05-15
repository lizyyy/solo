package com.identity.verification.model.enums;

public enum VerificationStatus {
    CREATED("已创建"),
    VERIFYING("校验中"),
    CONFLICT("存在冲突"),
    PENDING_CONFIRM("待人工确认"),
    CONFIRMED("已确认"),
    MERGED("已合并"),
    REVOKED("已撤销");

    private final String description;

    VerificationStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
