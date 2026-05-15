package com.edge.config.ack.enums;

import lombok.Getter;

@Getter
public enum DeliveryStatusEnum {
    PENDING_ACK(1, "待签收"),
    ACKED(2, "已签收"),
    EFFECTING(3, "生效中"),
    EFFECTED(4, "已生效"),
    ACK_FAILED(5, "签收失败"),
    EFFECT_FAILED(6, "生效失败");

    private final Integer code;
    private final String desc;

    DeliveryStatusEnum(Integer code, String desc) {
        this.code = code;
        this.desc = desc;
    }

    public static DeliveryStatusEnum of(Integer code) {
        for (DeliveryStatusEnum e : values()) {
            if (e.getCode().equals(code)) {
                return e;
            }
        }
        return null;
    }
}
