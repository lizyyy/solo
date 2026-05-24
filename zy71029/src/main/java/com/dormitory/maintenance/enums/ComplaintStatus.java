package com.dormitory.maintenance.enums;

public enum ComplaintStatus {
    PENDING("待处理"),
    PROCESSING("处理中"),
    RESOLVED("已解决"),
    DISMISSED("已驳回");

    private final String description;

    ComplaintStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
