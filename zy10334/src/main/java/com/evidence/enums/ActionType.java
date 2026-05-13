package com.evidence.enums;

import lombok.Getter;

@Getter
public enum ActionType {
    INBOUND_REQUEST("INBOUND_REQUEST", "入口请求"),
    INTERNAL_TRANSFORM("INTERNAL_TRANSFORM", "内部转换"),
    DB_OPERATION("DB_OPERATION", "数据库操作"),
    EXTERNAL_CALL("EXTERNAL_CALL", "外部调用"),
    EXTERNAL_RECEIPT("EXTERNAL_RECEIPT", "外部回执"),
    ERROR_HANDLING("ERROR_HANDLING", "异常处理"),
    MANUAL_REMARK("MANUAL_REMARK", "人工备注");

    private final String code;
    private final String desc;

    ActionType(String code, String desc) {
        this.code = code;
        this.desc = desc;
    }
}
