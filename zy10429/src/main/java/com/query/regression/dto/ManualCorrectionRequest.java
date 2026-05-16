package com.query.regression.dto;

import com.query.regression.enums.ConclusionType;
import com.query.regression.enums.RiskLevel;
import lombok.Data;

@Data
public class ManualCorrectionRequest {
    private RiskLevel riskLevel;
    private ConclusionType conclusion;
    private String conclusionNotes;
    private String correctedBy;
}
