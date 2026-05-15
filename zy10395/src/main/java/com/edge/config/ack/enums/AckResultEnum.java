package com.edge.config.ack.enums;

import lombok.Getter;

@Getter
public enum AckResultEnum {
    SUCCESS(1, "成功"),
    FAILED(2, "失败");

    private final Integer code;
    private final String desc;

    AckResultEnum(Integer code, String desc) {
        this.code = code;
        this.desc = desc;
    }

    public static AckResultEnum of(Integer code) {
        for (AckResultEnum e : values()) {
            if (e.getCode().equals(code)) {
                return e;
            }
        }
        return null;
    }
}
