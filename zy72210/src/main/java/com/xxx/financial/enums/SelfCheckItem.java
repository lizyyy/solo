package com.xxx.financial.enums;

public enum SelfCheckItem {
    DUPLICATE_IMPORT("重复导入检查", CheckSeverity.ERROR),
    APPROVER_PINYIN("审批人拼音检查", CheckSeverity.WARNING),
    SUPPLEMENT_RECALCULATE("补录后重算检查", CheckSeverity.ERROR),
    EXPORT_CONSISTENCY("导出一致性检查", CheckSeverity.ERROR),
    BALANCE_HISTORY_MATCH("余额与历史匹配检查", CheckSeverity.ERROR),
    TAIL_TRUSTEE_CONFLICT("尾差与托管冲突检查", CheckSeverity.ERROR);

    private final String description;
    private final CheckSeverity defaultSeverity;

    SelfCheckItem(String description, CheckSeverity defaultSeverity) {
        this.description = description;
        this.defaultSeverity = defaultSeverity;
    }

    public String getDescription() {
        return description;
    }

    public CheckSeverity getDefaultSeverity() {
        return defaultSeverity;
    }
}
