package com.paymentguard.common.enums;

import lombok.Getter;

@Getter
public enum IssueType {
    DUPLICATE_PAYMENT("重复扣款"),
    ORDER_STATUS_INCONSISTENCY("订单状态不一致"),
    CALLBACK_TIMEOUT("回调处理超时"),
    MESSAGE_CONSUME_FAILED("消息消费失败"),
    IDEMPOTENCY_FAILURE("幂等性失效"),
    LOCK_ACQUISITION_FAILED("分布式锁获取失败"),
    DATA_INTEGRITY_ISSUE("数据完整性问题"),
    CONCURRENCY_CONFLICT("并发冲突");

    private final String description;

    IssueType(String description) {
        this.description = description;
    }
}
