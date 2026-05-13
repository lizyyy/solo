package com.evidence.enums;

import lombok.Getter;

@Getter
public enum EvidenceStatus {
    CREATED("CREATED", "已创建"),
    PROCESSING("PROCESSING", "处理中"),
    SUCCESS("SUCCESS", "成功"),
    FAILED("FAILED", "失败"),
    MANUAL_HANDLED("MANUAL_HANDLED", "人工处理");

    private final String code;
    private final String desc;

    EvidenceStatus(String code, String desc) {
        this.code = code;
        this.desc = desc;
    }
}
