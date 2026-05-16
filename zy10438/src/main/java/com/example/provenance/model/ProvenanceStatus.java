package com.example.provenance.model;

public enum ProvenanceStatus {
    SUBMITTED,
    SOURCE_VERIFIED,
    SIGNATURE_VERIFIED,
    VERIFIED,
    EXCEPTION_REQUESTED,
    EXCEPTION_APPROVED,
    EXCEPTION_REJECTED,
    FAILED,
    MANUALLY_CORRECTED
}
