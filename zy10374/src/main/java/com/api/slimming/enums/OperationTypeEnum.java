package com.api.slimming.enums;

import lombok.Getter;

@Getter
public enum OperationTypeEnum {

    CREATE(1, "创建规则"),
    VALIDATE(2, "校验规则"),
    ACTIVATE(3, "激活规则"),
    DEACTIVATE(4, "停用规则"),
    ROLLBACK(5, "回滚规则"),
    UPDATE(6, "更新规则");

    private final Integer code;
    private final String desc;

    OperationTypeEnum(Integer code, String desc) {
        this.code = code;
        this.desc = desc;
    }
}
