package com.apidiff.dto;

import com.apidiff.entity.enums.ConfirmationStatus;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class ApiDiffResponse {

    private Long id;
    private String apiPath;
    private String httpMethod;
    private String versionA;
    private String versionB;
    private Boolean hasDifferences;
    private Integer diffCount;
    private String diffSummary;
    private ConfirmationStatus status;
    private String attributionNote;
    private String attributedBy;
    private LocalDateTime attributedAt;
    private String confirmedBy;
    private LocalDateTime confirmedAt;
    private String tags;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String createdBy;

    private List<DiffFieldDTO> diffFields;
}
