package com.notebook.artifact.dto;

import lombok.Data;
import java.util.Map;

@Data
public class ManualCorrectionRequest {
    private String correctedBy;
    private String correctionReason;
    private Map<String, Object> correctedParameters;
    private String executionLogUpdate;
}
