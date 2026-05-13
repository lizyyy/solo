package com.api.inspection.enums;

public enum TransactionStatus {
    DRAFT("草稿"),
    VALIDATED("已校验"),
    PENDING("待执行"),
    RUNNING("执行中"),
    SUCCESS("执行成功"),
    FAILED("执行失败"),
    CANCELLED("已撤销");

    private final String description;

    TransactionStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }

    public boolean canTransitionTo(TransactionStatus next) {
        switch (this) {
            case DRAFT:
                return next == VALIDATED || next == CANCELLED;
            case VALIDATED:
                return next == PENDING || next == DRAFT || next == CANCELLED;
            case PENDING:
                return next == RUNNING || next == CANCELLED;
            case RUNNING:
                return next == SUCCESS || next == FAILED || next == CANCELLED;
            case SUCCESS:
            case FAILED:
            case CANCELLED:
                return false;
            default:
                return false;
        }
    }
}
