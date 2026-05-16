package com.ci.cache.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "processing_exceptions")
public class ProcessingException {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String operationType;

    @Column(length = 4000)
    private String originalInput;

    @Column(length = 2000)
    private String errorMessage;

    @Column(length = 4000)
    private String stackTrace;

    @Column(length = 2000)
    private String processingConclusion;

    @Column(nullable = false)
    private LocalDateTime occurredAt;

    private String relatedApplicationId;
    private String relatedCacheKey;

    public ProcessingException() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getOperationType() { return operationType; }
    public void setOperationType(String operationType) { this.operationType = operationType; }
    public String getOriginalInput() { return originalInput; }
    public void setOriginalInput(String originalInput) { this.originalInput = originalInput; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public String getStackTrace() { return stackTrace; }
    public void setStackTrace(String stackTrace) { this.stackTrace = stackTrace; }
    public String getProcessingConclusion() { return processingConclusion; }
    public void setProcessingConclusion(String processingConclusion) { this.processingConclusion = processingConclusion; }
    public LocalDateTime getOccurredAt() { return occurredAt; }
    public void setOccurredAt(LocalDateTime occurredAt) { this.occurredAt = occurredAt; }
    public String getRelatedApplicationId() { return relatedApplicationId; }
    public void setRelatedApplicationId(String relatedApplicationId) { this.relatedApplicationId = relatedApplicationId; }
    public String getRelatedCacheKey() { return relatedCacheKey; }
    public void setRelatedCacheKey(String relatedCacheKey) { this.relatedCacheKey = relatedCacheKey; }
}
