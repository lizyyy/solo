package com.migration.dualwrite.constant;

public class ErrorCode {
    public static final String TASK_NOT_FOUND = "TASK_NOT_FOUND";
    public static final String TASK_ALREADY_EXISTS = "TASK_ALREADY_EXISTS";
    public static final String INVALID_STATUS_TRANSITION = "INVALID_STATUS_TRANSITION";
    public static final String VALIDATION_FAILED = "VALIDATION_FAILED";
    public static final String OLD_WRITE_FAILED = "OLD_WRITE_FAILED";
    public static final String NEW_WRITE_FAILED = "NEW_WRITE_FAILED";
    public static final String COMPARE_FAILED = "COMPARE_FAILED";
    public static final String DIFF_BLOCK_SWITCH = "DIFF_BLOCK_SWITCH";
    public static final String SWITCH_NOT_ALLOWED = "SWITCH_NOT_ALLOWED";
    public static final String ROLLBACK_NOT_ALLOWED = "ROLLBACK_NOT_ALLOWED";
    public static final String IDEMPOTENT_KEY_GENERATE_FAILED = "IDEMPOTENT_KEY_GENERATE_FAILED";
}
