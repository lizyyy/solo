package com.paymentguard.common.enums;

import lombok.Getter;

@Getter
public enum OrderStatus {
    PENDING("待支付", 0),
    PAID("已支付", 1),
    FAILED("支付失败", 2),
    CANCELLED("已取消", 3),
    REFUNDING("退款中", 4),
    REFUNDED("已退款", 5);

    private final String description;
    private final int code;

    OrderStatus(String description, int code) {
        this.description = description;
        this.code = code;
    }

    public static OrderStatus fromCode(int code) {
        for (OrderStatus status : values()) {
            if (status.code == code) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown order status code: " + code);
    }

    public boolean canTransitionTo(OrderStatus next) {
        return switch (this) {
            case PENDING -> next == PAID || next == FAILED || next == CANCELLED;
            case PAID -> next == REFUNDING || next == REFUNDED;
            case REFUNDING -> next == REFUNDED || next == PAID;
            default -> false;
        };
    }
}
