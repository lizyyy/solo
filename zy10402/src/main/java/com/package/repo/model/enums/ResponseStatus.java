package com.package.repo.model.enums;

public enum ResponseStatus {
    SUCCESS("成功"),
    PENDING_REVIEW("待复核"),
    BLOCKED("被拦截"),
    COMPENSATED("已补偿"),
    FAILED("失败");

    private final String description;

    ResponseStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
