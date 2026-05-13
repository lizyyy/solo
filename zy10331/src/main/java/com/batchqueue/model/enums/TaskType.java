package com.batchqueue.model.enums;

public enum TaskType {
    DATA_PROCESSING("数据处理"),
    REPORT_GENERATION("报表生成"),
    BATCH_IMPORT("批量导入"),
    BATCH_EXPORT("批量导出"),
    SYSTEM_MAINTENANCE("系统维护");

    private final String description;

    TaskType(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
