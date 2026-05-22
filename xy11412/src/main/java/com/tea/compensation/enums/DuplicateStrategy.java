package com.tea.compensation.enums;

import lombok.Getter;

@Getter
public enum DuplicateStrategy {
    IGNORE("忽略"),
    OVERWRITE("覆盖"),
    APPEND("追加");

    private final String description;

    DuplicateStrategy(String description) {
        this.description = description;
    }
}
