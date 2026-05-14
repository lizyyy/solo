package com.account.freeze.enums;

import lombok.Getter;

@Getter
public enum EvidenceChainStatus {
    COMPLETE("COMPLETE", "完整"),
    BROKEN("BROKEN", "断裂"),
    INVALID("INVALID", "无效");

    private final String code;
    private final String desc;

    EvidenceChainStatus(String code, String desc) {
        this.code = code;
        this.desc = desc;
    }
}
