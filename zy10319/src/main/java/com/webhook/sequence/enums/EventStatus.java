package com.webhook.sequence.enums;

import lombok.Getter;

@Getter
public enum EventStatus {
    PENDING("pending", "待处理"),
    WAITING("waiting", "等待中（乱序）"),
    PROCESSING("processing", "处理中"),
    SUCCESS("success", "处理成功"),
    FAILED("failed", "处理失败"),
    TIMEOUT("timeout", "超时"),
    SKIPPED("skipped", "跳过");

    private final String code;
    private final String desc;

    EventStatus(String code, String desc) {
        this.code = code;
        this.desc = desc;
    }
}
