package com.fund.refund.enums;

public enum DetailType {

    PRINCIPAL("本金", "principal"),
    FEE("手续费", "fee"),
    COMBINED("合并", "combined");

    private final String desc;
    private final String code;

    DetailType(String desc, String code) {
        this.desc = desc;
        this.code = code;
    }

    public String getDesc() {
        return desc;
    }

    public String getCode() {
        return code;
    }
}
