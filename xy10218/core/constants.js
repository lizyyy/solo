const CHECK_STATUS = {
    PASS: 'pass',
    WARNING: 'warning',
    FAIL: 'fail',
    PENDING: 'pending'
};

const ISSUE_TYPE = {
    DURATION_EXCEED: 'duration_exceed',
    DURATION_WARNING: 'duration_warning',
    SINGLE_DURATION_EXCEED: 'single_duration_exceed',
    DURATION_NAN: 'duration_nan',
    DURATION_NEGATIVE: 'duration_negative',
    DURATION_ZERO: 'duration_zero',
    DURATION_EMPTY: 'duration_empty',
    TITLE_EMPTY: 'title_empty',
    TITLE_WHITESPACE: 'title_whitespace',
    SENSITIVE_WORD: 'sensitive_word',
    PUBLISH_BLOCKED: 'publish_blocked',
    WITHDRAW_SUCCESS: 'withdraw_success'
};

const ISSUE_LEVEL = {
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
};

const PUBLISH_STATUS = {
    DRAFT: 'draft',
    PUBLISHED: 'published',
    WITHDRAWN: 'withdrawn'
};

const LOG_TYPE = {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error'
};

const MAX_SINGLE_DURATION = 30;
