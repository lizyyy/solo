package com.feiyong.feecalc.enums;

public enum CalculationStatus {
    CREATED("已创建"),
    VALIDATING("校验中"),
    CALCULATING("试算中"),
    SUCCESS("试算成功"),
    LOCKED("已锁价"),
    CHARGED("已扣费"),
    EXPIRED("已过期"),
    FAILED("失败");

    private final String description;

    CalculationStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
