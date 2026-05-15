package com.edge.config.ack.common;

import lombok.Getter;

@Getter
public enum ErrorCode {
    SUCCESS(0, "成功"),
    PARAM_ERROR(10001, "参数错误"),
    NODE_NOT_EXIST(10002, "节点不存在"),
    VERSION_NOT_EXIST(10003, "配置版本不存在"),
    DELIVERY_NOT_EXIST(10004, "下发记录不存在"),
    DUPLICATE_DELIVERY(10005, "该节点配置已下发，请勿重复提交"),
    INVALID_STATUS_TRANSITION(10006, "状态流转不合法"),
    IDEMPOTENT_KEY_EXIST(10007, "请求已处理，请勿重复提交"),
    ACK_NOT_ALLOWED(10008, "当前状态不允许签收"),
    CHECK_NOT_ALLOWED(10009, "当前状态不允许校验"),
    RETRY_EXHAUSTED(10010, "重试次数已耗尽"),
    SYSTEM_ERROR(99999, "系统内部错误");

    private final Integer code;
    private final String message;

    ErrorCode(Integer code, String message) {
        this.code = code;
        this.message = message;
    }
}
