package com.grayscale.rollback.enums;

public enum ReleaseEvent {
    START_PREPARING,
    ADVANCE_TO_CANARY_10,
    ADVANCE_TO_CANARY_30,
    ADVANCE_TO_CANARY_50,
    ADVANCE_TO_CANARY_100,
    COMPLETE,
    TRIGGER_ROLLBACK,
    ROLLBACK_COMPLETE,
    FAIL
}
