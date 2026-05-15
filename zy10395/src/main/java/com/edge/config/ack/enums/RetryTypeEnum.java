package com.edge.config.ack.enums;

import lombok.Getter;

@Getter
public enum RetryTypeEnum {
    REDO_DELIVERY(1, "补发配置"),
    REDO_CHECK(2, "重新校验");

    private final Integer code;
    private final String desc;

    RetryTypeEnum(Integer code, String desc) {
        this.code = code;
        this.desc = desc;
    }
}
