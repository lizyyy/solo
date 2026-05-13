package com.schema.approval.exception;

public class ErrorCode {
    public static final String TOPIC_NOT_FOUND = "TOPIC_001";
    public static final String TOPIC_ALREADY_EXISTS = "TOPIC_002";
    public static final String SCHEMA_VERSION_NOT_FOUND = "SCHEMA_001";
    public static final String DUPLICATE_REQUEST = "SCHEMA_002";
    public static final String INVALID_STATUS_TRANSITION = "SCHEMA_003";
    public static final String COMPATIBILITY_CHECK_FAILED = "SCHEMA_004";
    public static final String APPROVAL_ALREADY_PROCESSED = "SCHEMA_005";
    public static final String INVALID_APPROVAL_STEP = "SCHEMA_006";
    public static final String SCHEMA_NOT_APPROVED = "SCHEMA_007";
    public static final String SCHEMA_ALREADY_PUBLISHED = "SCHEMA_008";
}
