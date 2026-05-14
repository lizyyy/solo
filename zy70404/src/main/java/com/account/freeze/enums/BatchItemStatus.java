package com.account.freeze.enums;

import lombok.Getter;

@Getter
public enum BatchItemStatus {
    PENDING("PENDING", "待处理"),
    PREVIEWED("PREVIEWED", "已预览"),
    PROCESSING("PROCESSING", "处理中"),
    SUCCESS("SUCCESS", "成功"),
    FAILED("FAILED", "失败"),
    SKIPPED("SKIPPED", "已跳过");

    private final String code;
    private final String desc;

    BatchItemStatus(String code, String desc) {
        this.code = code;
        this.desc = desc;
    }
}
