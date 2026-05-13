package com.api.inspection.enums;

public enum AssertionType {
    STATUS_CODE("状态码校验"),
    RESPONSE_BODY("响应体校验"),
    JSON_PATH("JSON路径校验"),
    HEADER("响应头校验"),
    TIME("响应时间校验");

    private final String description;

    AssertionType(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
