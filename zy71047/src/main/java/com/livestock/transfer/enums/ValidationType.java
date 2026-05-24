package com.livestock.transfer.enums;

public enum ValidationType {
    EAR_TAG_DUPLICATE_IN_ORDER("单内耳标重复"),
    EAR_TAG_DUPLICATE_ACROSS_ORDERS("跨单耳标重复"),
    QUARANTINE_CERT_EXPIRED("检疫证过期"),
    QUARANTINE_CERT_INVALID("检疫证无效"),
    QUARANTINE_CERT_COUNT_MISMATCH("检疫证数量不匹配"),
    VEHICLE_UNAVAILABLE("运输车不可用"),
    SOURCE_TARGET_SAME("源牧场和目标牧场相同"),
    TAG_COUNT_MISMATCH("耳标数量与计划数量不匹配");

    private final String description;

    ValidationType(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
