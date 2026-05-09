package com.paymentguard.common.enums;

import lombok.Getter;

@Getter
public enum CallbackStatus {
    RECEIVED("已接收", 0),
    PROCESSING("处理中", 1),
    SUCCESS("处理成功", 2),
    FAILED("处理失败", 3),
    DUPLICATE("重复回调", 4),
    TIMEOUT("处理超时", 5);

    private final String description;
    private final int code;

    CallbackStatus(String description, int code) {
        this.description = description;
        this.code = code;
    }

    public static CallbackStatus fromCode(int code) {
        for (CallbackStatus status : values()) {
            if (status.code == code) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown callback status code: " + code);
    }
}
