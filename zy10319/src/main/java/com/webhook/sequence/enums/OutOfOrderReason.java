package com.webhook.sequence.enums;

import lombok.Getter;

@Getter
public enum OutOfOrderReason {
    GAP("gap", "序列号缺口"),
    DUPLICATE("duplicate", "重复序列号"),
    RETROACTIVE("retroactive", "回溯序列号"),
    TIMEOUT("timeout", "等待超时"),
    NONE("none", "无乱序");

    private final String code;
    private final String desc;

    OutOfOrderReason(String code, String desc) {
        this.code = code;
        this.desc = desc;
    }
}
