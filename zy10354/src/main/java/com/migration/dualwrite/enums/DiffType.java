package com.migration.dualwrite.enums;

import lombok.Getter;

@Getter
public enum DiffType {
    VALUE_MISMATCH("VALUE_MISMATCH", "值不一致"),
    TYPE_MISMATCH("TYPE_MISMATCH", "类型不一致"),
    MISSING_IN_OLD("MISSING_IN_OLD", "旧库缺失"),
    MISSING_IN_NEW("MISSING_IN_NEW", "新库缺失"),
    NULL_VS_NON_NULL("NULL_VS_NON_NULL", "空值差异"),
    LENGTH_MISMATCH("LENGTH_MISMATCH", "长度差异"),
    PRECISION_MISMATCH("PRECISION_MISMATCH", "精度差异");

    private final String code;
    private final String desc;

    DiffType(String code, String desc) {
        this.code = code;
        this.desc = desc;
    }
}
