package com.devicecommand.enums;

public enum CommandStatus {
    CREATED("已创建"),
    VALIDATED("已校验"),
    DISPATCHED("已下发"),
    CONFIRMING("等待确认"),
    SUCCESS("执行成功"),
    FAILED("执行失败"),
    TIMEOUT("确认超时"),
    RETRYING("补发中"),
    CANCELLED("已取消");

    private final String description;

    CommandStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
