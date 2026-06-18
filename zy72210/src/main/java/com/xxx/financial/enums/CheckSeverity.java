package com.xxx.financial.enums;

public enum CheckSeverity {
    ERROR("错误-阻断流程，必须修正数据"),
    WARN("警告-不阻断但需人工处理，处理后可继续");

    private final String description;

    CheckSeverity(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
