package com.datarepair.approval.enums;

import lombok.Getter;

@Getter
public enum ScriptStatus {

    DRAFT(0, "草稿"),
    SUBMITTED(1, "已提交"),
    VALIDATING(2, "校验中"),
    VALIDATED(3, "校验通过"),
    DRY_RUNNING(4, "试跑中"),
    DRY_RUN_SUCCESS(5, "试跑成功"),
    PENDING_APPROVAL(6, "待审批"),
    APPROVED(7, "已批准"),
    REJECTED(8, "已拒绝"),
    EXECUTING(9, "执行中"),
    EXECUTE_SUCCESS(10, "执行成功"),
    EXECUTE_FAILED(11, "执行失败"),
    ROLLING_BACK(12, "回滚中"),
    ROLLBACK_SUCCESS(13, "回滚成功"),
    ROLLBACK_FAILED(14, "回滚失败"),
    CANCELLED(15, "已取消");

    private final Integer code;
    private final String desc;

    ScriptStatus(Integer code, String desc) {
        this.code = code;
        this.desc = desc;
    }

    public static ScriptStatus fromCode(Integer code) {
        for (ScriptStatus status : values()) {
            if (status.getCode().equals(code)) {
                return status;
            }
        }
        return null;
    }
}
