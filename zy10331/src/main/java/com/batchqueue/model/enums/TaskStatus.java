package com.batchqueue.model.enums;

public enum TaskStatus {
    PENDING("待执行"),
    WAITING("等待中"),
    RUNNING("执行中"),
    PREEMPTED("被抢占"),
    COMPLETED("已完成"),
    CANCELLED("已撤销"),
    FAILED("执行失败");

    private final String description;

    TaskStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
