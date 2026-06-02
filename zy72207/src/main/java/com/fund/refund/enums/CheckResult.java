package com.fund.refund.enums;

public enum CheckResult {

    PASSED("通过", "passed"),
    FAILED("未通过", "failed"),
    WARNING("警告", "warning");

    private final String desc;
    private final String code;

    CheckResult(String desc, String code) {
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
