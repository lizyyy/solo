package com.paymentguard.common.enums;

import lombok.Getter;

@Getter
public enum ScenarioType {
    HIGH_CONCURRENCY("高并发场景"),
    DUPLICATE_REQUEST("重复请求场景"),
    SERVICE_TIMEOUT("服务超时场景"),
    NETWORK_FAILURE("网络故障场景"),
    MESSAGE_REDELIVERY("消息重复消费场景"),
    MIXED("混合异常场景");

    private final String description;

    ScenarioType(String description) {
        this.description = description;
    }
}
