package com.query.regression.exception;

import com.query.regression.enums.RegressionStatus;

public class InvalidStatusTransitionException extends RuntimeException {
    private final RegressionStatus fromStatus;
    private final RegressionStatus toStatus;

    public InvalidStatusTransitionException(RegressionStatus from, RegressionStatus to) {
        super(String.format("无效的状态转换: %s -> %s", from, to));
        this.fromStatus = from;
        this.toStatus = to;
    }

    public RegressionStatus getFromStatus() { return fromStatus; }
    public RegressionStatus getToStatus() { return toStatus; }
}
