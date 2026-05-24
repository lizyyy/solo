package com.ortho.rework.dto;

import lombok.Data;

@Data
public class InspectionRequest {
    private String inspectionResult;
    private String conclusion;
    private String reporter;
}
