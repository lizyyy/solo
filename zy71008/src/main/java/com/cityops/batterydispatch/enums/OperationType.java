package com.cityops.batterydispatch.enums;

public enum OperationType {
    CREATE_TASK("创建任务"),
    AUTO_CHECK("系统自动校验"),
    MANUAL_CONFIRM("人工确认"),
    DISPATCH("派送电池"),
    ARRIVE("到达现场"),
    SIGN_FOR("签收"),
    COMPLETE("完成换电"),
    CANCEL("取消任务"),
    SYSTEM_REVIEW("系统复核"),
    ADMIN_OVERRIDE("管理员干预");

    private final String description;

    OperationType(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
