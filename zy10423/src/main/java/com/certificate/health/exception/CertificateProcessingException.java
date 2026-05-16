package com.certificate.health.exception;

import lombok.Getter;

@Getter
public class CertificateProcessingException extends RuntimeException {

    private final String originalInputHash;
    private final String processingConclusion;

    public CertificateProcessingException(String message, String originalInputHash, String processingConclusion) {
        super(message);
        this.originalInputHash = originalInputHash;
        this.processingConclusion = processingConclusion;
    }

    public CertificateProcessingException(String message, Throwable cause, String originalInputHash, String processingConclusion) {
        super(message, cause);
        this.originalInputHash = originalInputHash;
        this.processingConclusion = processingConclusion;
    }
}
