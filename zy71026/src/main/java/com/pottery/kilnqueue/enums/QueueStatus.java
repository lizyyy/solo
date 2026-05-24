package com.pottery.kilnqueue.enums;

public enum QueueStatus {
    PENDING,
    VALIDATING,
    CONFLICT_DETECTED,
    APPROVED,
    REJECTED,
    RESCHEDULED,
    IN_BATCH,
    FIRED,
    CANCELLED
}
