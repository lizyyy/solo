package com.compensation.enums;

public enum RequestStatus {
    CREATED,
    VALIDATING,
    VALIDATED,
    EXECUTING,
    PARTIAL_SUCCESS,
    COMPENSATING,
    COMPLETED,
    FAILED,
    CANCELLED
}
