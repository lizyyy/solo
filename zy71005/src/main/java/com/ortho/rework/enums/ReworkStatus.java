package com.ortho.rework.enums;
public enum ReworkStatus {
    CREATED("已创建"),
    RECEIVED("已收件"),
    INSPECTED("已核验"),
    PROCESSING("处理中"),
    DOCTOR_CONFIRMED("医生已确认"),
    REVIEWED("已复查"),
    SHIPPED("已寄出"),
    CLOSED("已结案"),
    CANCELLED("已取消"),
    LOST("快递丢失");
    private final String description;
    ReworkStatus(String description) { this.description = description; }
    public String getDescription() { return description; }
}
