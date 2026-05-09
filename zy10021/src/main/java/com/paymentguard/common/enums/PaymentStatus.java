package com.paymentguard.common.enums;

import lombok.Getter;

@Getter
public enum PaymentStatus {
    PROCESSING("处理中", 0),
    SUCCESS("成功", 1),
    FAILED("失败", 2),
    TIMEOUT("超时", 3),
    DUPLICATE("重复回调", 4);

    private final String description;
    private final int code;

    PaymentStatus(String description, int code) {
        this.description = description;
        this.code = code;
    }

    public static PaymentStatus fromCode(int code) {
        for (PaymentStatus status : values()) {
            if (status.code == code) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown payment status code: " + code);
    }
}
