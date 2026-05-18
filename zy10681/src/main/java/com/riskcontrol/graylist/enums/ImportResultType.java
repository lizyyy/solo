package com.riskcontrol.graylist.enums;

public enum ImportResultType {
    SUCCESS("导入成功"),
    CONFLICT("记录冲突"),
    INVALID("数据错误"),
    SKIPPED("已跳过");

    private final String description;

    ImportResultType(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
