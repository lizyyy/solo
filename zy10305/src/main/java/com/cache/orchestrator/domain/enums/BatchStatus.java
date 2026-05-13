package com.cache.orchestrator.domain.enums;

public enum BatchStatus {
    CREATED,
    VALIDATED,
    PROCESSING,
    PARTIAL_SUCCESS,
    SUCCESS,
    FAILED,
    RETRYING
}
