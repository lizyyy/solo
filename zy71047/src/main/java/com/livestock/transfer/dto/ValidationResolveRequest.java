package com.livestock.transfer.dto;

public class ValidationResolveRequest {
    private Long validationId;
    private String resolvedBy;
    private String resolutionNote;

    public Long getValidationId() { return validationId; }
    public void setValidationId(Long validationId) { this.validationId = validationId; }
    public String getResolvedBy() { return resolvedBy; }
    public void setResolvedBy(String resolvedBy) { this.resolvedBy = resolvedBy; }
    public String getResolutionNote() { return resolutionNote; }
    public void setResolutionNote(String resolutionNote) { this.resolutionNote = resolutionNote; }
}
