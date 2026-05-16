package com.dns.preplay.model.enums;

public enum PreplayStatus {
    CREATED,
    DIFF_CALCULATED,
    TTL_CHECKED,
    READY_FOR_SWITCH,
    SWITCH_CONFIRMED,
    ROLLBACK_RECORDED,
    COMPLETED,
    FAILED
}
