package com.agri.dronespray.entity;

public enum CheckType {
    WEATHER_WINDOW("天气窗口校验", "校验作业时段天气是否适宜飞行"),
    NO_FLY_TIME("禁飞时段校验", "校验作业时间是否在禁飞时段内"),
    PESTICIDE_MATCH("药剂匹配校验", "校验药剂是否适合作物和虫害类型"),
    PLOT_APPROVAL("地块审批校验", "校验地块是否已通过审批"),
    DUPLICATE_OPERATION("重复作业校验", "校验地块近期是否已进行相同作业"),
    DRONE_STATUS("无人机状态校验", "校验无人机是否处于可用状态"),
    PILOT_QUALIFICATION("飞手资质校验", "校验飞手是否具备相应资质");

    private final String displayName;
    private final String description;

    CheckType(String displayName, String description) {
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
