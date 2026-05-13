package com.approval.coordinator.model.enums;

public enum BatchStatus {
    CREATED,
    VALIDATING,
    VALIDATED,
    PROCESSING,
    PARTIAL_SUCCESS,
    COMPLETED,
    FAILED,
    REPLAYING
}
