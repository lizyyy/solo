package com.statuspage.dto;

import com.statuspage.model.IncidentStatus;
import com.statuspage.model.ServiceStatus;
import lombok.Data;

@Data
public class ManualCorrectionRequest {
    private String title;

    private String description;

    private IncidentStatus incidentStatus;

    private ServiceStatus serviceStatus;

    private String affectedServices;

    private String reviewSummary;

    private String operator;

    private String reason;
}