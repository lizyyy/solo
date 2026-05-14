package com.account.freeze.enums;

import lombok.Getter;

@Getter
public enum BatchType {
    SMS("SMS", "短信补录"),
    MANUAL("MANUAL", "手动录入");

    private final String code;
    private final String desc;

    BatchType(String code, String desc) {
        this.code = code;
        this.desc = desc;
    }
}
