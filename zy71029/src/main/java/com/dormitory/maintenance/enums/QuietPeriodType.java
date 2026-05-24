package com.dormitory.maintenance.enums;

public enum QuietPeriodType {
    EXAM_WEEK("考试周"),
    LUNCH_BREAK("午休"),
    NIGHT_REST("夜间休息"),
    HOLIDAY("节假日"),
    CUSTOM("自定义");

    private final String description;

    QuietPeriodType(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
