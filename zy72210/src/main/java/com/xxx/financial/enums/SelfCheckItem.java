package com.xxx.financial.enums;

public enum SelfCheckItem {
    DUPLICATE_IMPORT("重复导入检查"),
    APPROVER_PINYIN("审批人拼音检查"),
    SUPPLEMENT_RECALCULATE("补录后重算检查"),
    EXPORT_CONSISTENCY("导出一致性检查"),
    BALANCE_HISTORY_MATCH("余额与历史匹配检查"),
    TAIL_TRUSTEE_CONFLICT("尾差与托管冲突检查");

    private final String description;

    SelfCheckItem(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
