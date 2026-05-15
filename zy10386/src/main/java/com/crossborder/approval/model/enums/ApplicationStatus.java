package com.crossborder.approval.model.enums;

public enum ApplicationStatus {
    DRAFT,
    PENDING_REGION_VALIDATION,
    REGION_VALIDATED,
    PENDING_APPROVAL,
    APPROVED,
    REJECTED,
    TOKEN_ISSUED,
    TOKEN_EXPIRED,
    TOKEN_REVOKED,
    CANCELLED
}
