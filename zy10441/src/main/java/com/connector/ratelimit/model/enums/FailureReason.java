package com.connector.ratelimit.model.enums;

public enum FailureReason {
    RATE_LIMIT_EXCEEDED,
    AUTH_FAILED,
    NETWORK_ERROR,
    SERVER_ERROR,
    TIMEOUT,
    INVALID_RESPONSE,
    MANUAL_TRIGGER,
    UNKNOWN
}
