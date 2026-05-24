package com.bus.notify.enums;

public enum RouteChangeStatus {
    DRAFT("草稿", "改线信息已录入，待核验"),
    VERIFIED("已核验", "改线信息核验通过，待处理"),
    PROCESSING("处理中", "正在进行乘客通知"),
    REVIEWING("复查中", "通知完成，待复查确认"),
    COMPLETED("已结案", "改线通知全部完成，已结案"),
    CANCELLED("已取消", "改线计划取消");

    private final String displayName;
    private final String description;

    RouteChangeStatus(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getDescription() {
        return description;
    }
}
