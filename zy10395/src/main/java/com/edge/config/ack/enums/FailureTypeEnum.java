package com.edge.config.ack.enums;

import lombok.Getter;

@Getter
public enum FailureTypeEnum {
    ACK_FAILED(1, "签收失败"),
    EFFECT_FAILED(2, "生效失败");

    private final Integer code;
    private final String desc;

    FailureTypeEnum(Integer code, String desc) {
        this.code = code;
        this.desc = desc;
    }
}
