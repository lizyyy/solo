package com.edge.config.ack.enums;

import lombok.Getter;

@Getter
public enum RetryStatusEnum {
    PENDING(1, "待执行"),
    RUNNING(2, "执行中"),
    SUCCESS(3, "成功"),
    FAILED(4, "失败"),
    CANCELLED(5, "已取消");

    private final Integer code;
    private final String desc;

    RetryStatusEnum(Integer code, String desc) {
        this.code = code;
        this.desc = desc;
    }

    public static RetryStatusEnum of(Integer code) {
        for (RetryStatusEnum e : values()) {
            if (e.getCode().equals(code)) {
                return e;
            }
        }
        return null;
    }
}
