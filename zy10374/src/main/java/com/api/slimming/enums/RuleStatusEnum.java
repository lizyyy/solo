package com.api.slimming.enums;

import lombok.Getter;

@Getter
public enum RuleStatusEnum {

    DRAFT(0, "草稿"),
    VALIDATING(10, "校验中"),
    VALID(20, "已生效"),
    INVALID(30, "已失效"),
    ROLLBACKED(40, "已回滚");

    private final Integer code;
    private final String desc;

    RuleStatusEnum(Integer code, String desc) {
        this.code = code;
        this.desc = desc;
    }

    public static RuleStatusEnum getByCode(Integer code) {
        for (RuleStatusEnum e : values()) {
            if (e.getCode().equals(code)) {
                return e;
            }
        }
        return null;
    }
}
