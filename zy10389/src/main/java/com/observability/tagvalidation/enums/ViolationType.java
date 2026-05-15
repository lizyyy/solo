package com.observability.tagvalidation.enums;

public enum ViolationType {
    UNKNOWN_TAG_KEY,
    INVALID_TAG_VALUE,
    MISSING_REQUIRED_TAG,
    FORMAT_MISMATCH,
    DUPLICATE_TAG
}
