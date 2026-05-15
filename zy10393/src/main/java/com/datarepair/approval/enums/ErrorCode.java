package com.datarepair.approval.enums;

import lombok.Getter;

@Getter
public enum ErrorCode {

    SUCCESS(0, "成功"),
    PARAM_ERROR(1001, "参数错误"),
    SCRIPT_NOT_EXIST(1002, "脚本不存在"),
    SCRIPT_ALREADY_EXIST(1003, "脚本已存在"),
    INVALID_STATUS_TRANSITION(1004, "状态流转不合法"),
    DUPLICATE_SUBMISSION(1005, "重复提交"),
    VALIDATION_FAILED(1006, "校验失败"),
    DRY_RUN_FAILED(1007, "试跑失败"),
    APPROVAL_REQUIRED(1008, "需要审批"),
    EXECUTE_FAILED(1009, "执行失败"),
    ROLLBACK_FAILED(1010, "回滚失败"),
    NO_PERMISSION(1011, "无权限操作"),
    BATCH_NOT_EXIST(1012, "执行批次不存在"),
    ROLLBACK_PROOF_MISSING(1013, "回滚证明缺失"),
    TARGET_SCOPE_EMPTY(1014, "目标范围为空"),
    SYSTEM_ERROR(9999, "系统错误");

    private final Integer code;
    private final String message;

    ErrorCode(Integer code, String message) {
        this.code = code;
        this.message = message;
    }
}
