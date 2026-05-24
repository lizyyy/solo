package com.floodrelief.dto;

import lombok.Data;

@Data
public class EvidenceUploadRequest {
    private Long allocationId;
    private String evidenceType;
    private String evidenceUrl;
    private String description;
    private String uploader;
}
