package com.statuspage.model;

public enum ServiceStatus {
    OPERATIONAL("正常运行"),
    DEGRADED_PERFORMANCE("性能下降"),
    PARTIAL_OUTAGE("部分中断"),
    MAJOR_OUTAGE("严重中断"),
    MAINTENANCE("维护中"),
    RESOLVED("已解决");

    private final String description;

    ServiceStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}