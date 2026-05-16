package com.connector.ratelimit.model.enums;

public enum RateLimitType {
    QPS,
    DAILY_LIMIT,
    HOURLY_LIMIT,
    CONCURRENCY,
    TOKEN_BUCKET,
    UNKNOWN
}
