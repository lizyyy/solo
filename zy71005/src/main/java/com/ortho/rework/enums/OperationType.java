package com.ortho.rework.enums;

public enum OperationType {
    CREATE_REWORK("创建返工单"),
    RECEIVE("收件登记"),
    INSPECT("到件核验"),
    TECHNICIAN_NOTE("技师备注"),
    DOCTOR_CONFIRM("医生确认"),
    START_PROCESSING("开始处理"),
    REVIEW("复查"),
    SHIP("寄出"),
    CLOSE("结案"),
    CANCEL("取消"),
    MARK_LOST("标记丢失"),
    EXPORT_REPORT("导出报告"),
    DUPLICATE_ATTEMPT("重复操作拦截");

    private final String description;

    OperationType(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
