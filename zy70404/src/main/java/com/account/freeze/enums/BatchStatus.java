package com.account.freeze.enums;

import lombok.Getter;

@Getter
public enum BatchStatus {
    DRAFT("DRAFT", "草稿"),
    PREVIEWED("PREVIEWED", "已预览"),
    EXECUTING("EXECUTING", "执行中"),
    PARTIAL_SUCCESS("PARTIAL_SUCCESS", "部分成功"),
    SUCCESS("SUCCESS", "全部成功"),
    FAILED("FAILED", "全部失败"),
    CANCELLED("CANCELLED", "已取消");

    private final String code;
    private final String desc;

    BatchStatus(String code, String desc) {
        this.code = code;
        this.desc = desc;
    }
}
