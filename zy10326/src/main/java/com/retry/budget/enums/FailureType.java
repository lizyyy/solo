package com.retry.budget.enums;

public enum FailureType {
    TRANSIENT,
    CLIENT_ERROR,
    SERVER_ERROR,
    TIMEOUT,
    NETWORK_ERROR,
    RATE_LIMITED,
    AUTHENTICATION_ERROR,
    UNKNOWN
}
