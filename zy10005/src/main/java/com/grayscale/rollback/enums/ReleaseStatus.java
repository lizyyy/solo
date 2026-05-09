package com.grayscale.rollback.enums;

public enum ReleaseStatus {
    PENDING,
    PREPARING,
    CANARY_10,
    CANARY_30,
    CANARY_50,
    CANARY_100,
    COMPLETED,
    ROLLBACKING,
    ROLLED_BACK,
    FAILED
}
