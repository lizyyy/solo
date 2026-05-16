package com.privacy.export.enums;

public enum ExportScopeCategory {
    PROFILE_DATA("个人基本资料"),
    CONTACT_DATA("联系方式"),
    TRANSACTION_DATA("交易记录"),
    BEHAVIOR_DATA("行为数据"),
    COMMUNICATION_DATA("通讯记录"),
    DOCUMENT_DATA("文档资料"),
    PAYMENT_DATA("支付信息"),
    LOCATION_DATA("位置信息"),
    DEVICE_DATA("设备信息"),
    THIRD_PARTY_DATA("第三方共享数据");

    private final String description;

    ExportScopeCategory(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
