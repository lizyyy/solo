package com.tea.compensation.enums;

import lombok.Getter;

@Getter
public enum TaskStatus {
    PENDING("待处理"),
    QUEUED("排队中"),
    PROCESSING("处理中"),
    SUCCESS("成功"),
    PARTIAL_FAILED("部分失败"),
    FAILED("失败"),
    RETRYING("重试中"),
    MANUAL_REVIEW("待人工审核"),
    COMPENSATED("已补偿入账"),
    CANCELLED("已取消"),
    CLOSED("已关闭"),
    FROZEN("已冻结"),
    DEAD_LETTER("死信");

    private final String description;

    TaskStatus(String description) {
        this.description = description;
    }

    public boolean isRetryable() {
        return this == FAILED || this == PARTIAL_FAILED || this == RETRYING;
    }

    public boolean isFinal() {
        return this == SUCCESS || this == COMPENSATED || this == CANCELLED || this == CLOSED || this == DEAD_LETTER;
    }
}
