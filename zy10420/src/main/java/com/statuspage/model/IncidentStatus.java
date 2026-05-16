package com.statuspage.model;

public enum IncidentStatus {
    INVESTIGATING("调查中"),
    IDENTIFIED("已确认"),
    MONITORING("监控中"),
    RESOLVED("已解决"),
    POST_MORTEM("复盘完成");

    private final String description;

    IncidentStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }

    public boolean canTransitionTo(IncidentStatus next) {
        return this.ordinal() < next.ordinal();
    }
}