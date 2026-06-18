package com.xxx.financial.enums;

public enum CheckSeverity {
    ERROR("阻断性错误", "必须解决才能继续流程"),
    WARNING("预警提示", "已通过人工复核后可继续");

    private final String label;
    private final String description;

    CheckSeverity(String label, String description) {
        this.label = label;
        this.description = description;
    }

    public String getLabel() {
        return label;
    }

    public String getDescription() {
        return description;
    }
}
