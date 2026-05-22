package com.tea.compensation.enums;

import lombok.Getter;

@Getter
public enum TaskType {
    ORDER_FORM("订货表"),
    LOSS_REGISTRATION("损耗登记"),
    HEADQUARTERS_PRICE("总部价格表"),
    SECONDARY_CONFIRMATION("二次确认单");

    private final String description;

    TaskType(String description) {
        this.description = description;
    }
}
