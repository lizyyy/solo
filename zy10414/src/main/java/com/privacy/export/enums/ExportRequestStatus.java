package com.privacy.export.enums;

public enum ExportRequestStatus {
    DRAFT,
    PENDING_CONSENT_VALIDATION,
    CONSENT_VALIDATED,
    PENDING_LEGAL_APPROVAL,
    LEGAL_APPROVED,
    PENDING_SCOPE_VALIDATION,
    SCOPE_VALIDATED,
    READY_FOR_PACKAGING,
    PACKAGING_IN_PROGRESS,
    PACKAGING_COMPLETED,
    READY_FOR_DELIVERY,
    DELIVERY_IN_PROGRESS,
    DELIVERED,
    COMPLETED,
    
    CONSENT_VALIDATION_FAILED,
    LEGAL_REJECTED,
    SCOPE_VALIDATION_FAILED,
    PACKAGING_FAILED,
    DELIVERY_FAILED,
    CANCELLED,
    NEEDS_MANUAL_CORRECTION;

    public boolean canTransitionTo(ExportRequestStatus nextStatus) {
        return switch (this) {
            case DRAFT -> nextStatus == PENDING_CONSENT_VALIDATION || nextStatus == CANCELLED;
            case PENDING_CONSENT_VALIDATION -> nextStatus == CONSENT_VALIDATED || nextStatus == CONSENT_VALIDATION_FAILED || nextStatus == NEEDS_MANUAL_CORRECTION;
            case CONSENT_VALIDATED -> nextStatus == PENDING_LEGAL_APPROVAL;
            case PENDING_LEGAL_APPROVAL -> nextStatus == LEGAL_APPROVED || nextStatus == LEGAL_REJECTED || nextStatus == NEEDS_MANUAL_CORRECTION;
            case LEGAL_APPROVED -> nextStatus == PENDING_SCOPE_VALIDATION;
            case PENDING_SCOPE_VALIDATION -> nextStatus == SCOPE_VALIDATED || nextStatus == SCOPE_VALIDATION_FAILED || nextStatus == NEEDS_MANUAL_CORRECTION;
            case SCOPE_VALIDATED -> nextStatus == READY_FOR_PACKAGING;
            case READY_FOR_PACKAGING -> nextStatus == PACKAGING_IN_PROGRESS;
            case PACKAGING_IN_PROGRESS -> nextStatus == PACKAGING_COMPLETED || nextStatus == PACKAGING_FAILED || nextStatus == NEEDS_MANUAL_CORRECTION;
            case PACKAGING_COMPLETED -> nextStatus == READY_FOR_DELIVERY;
            case READY_FOR_DELIVERY -> nextStatus == DELIVERY_IN_PROGRESS;
            case DELIVERY_IN_PROGRESS -> nextStatus == DELIVERED || nextStatus == DELIVERY_FAILED || nextStatus == NEEDS_MANUAL_CORRECTION;
            case DELIVERED -> nextStatus == COMPLETED;
            case NEEDS_MANUAL_CORRECTION -> nextStatus == DRAFT || nextStatus == CANCELLED;
            case CONSENT_VALIDATION_FAILED, LEGAL_REJECTED, SCOPE_VALIDATION_FAILED, PACKAGING_FAILED, DELIVERY_FAILED, CANCELLED, COMPLETED -> false;
        };
    }

    public boolean isTerminal() {
        return this == COMPLETED || this == CANCELLED || this == CONSENT_VALIDATION_FAILED 
                || this == LEGAL_REJECTED || this == SCOPE_VALIDATION_FAILED 
                || this == PACKAGING_FAILED || this == DELIVERY_FAILED;
    }

    public boolean requiresManualIntervention() {
        return this == NEEDS_MANUAL_CORRECTION;
    }
}
