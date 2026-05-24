package com.floodrelief.dto;

public class EvidenceUploadRequest {
    private Long allocationId;
    private String evidenceType;
    private String evidenceUrl;
    private String description;
    private String uploader;

    public Long getAllocationId() { return allocationId; }
    public void setAllocationId(Long allocationId) { this.allocationId = allocationId; }
    public String getEvidenceType() { return evidenceType; }
    public void setEvidenceType(String evidenceType) { this.evidenceType = evidenceType; }
    public String getEvidenceUrl() { return evidenceUrl; }
    public void setEvidenceUrl(String evidenceUrl) { this.evidenceUrl = evidenceUrl; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getUploader() { return uploader; }
    public void setUploader(String uploader) { this.uploader = uploader; }
}
