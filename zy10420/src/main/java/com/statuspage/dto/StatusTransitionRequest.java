package com.statuspage.dto;

import com.statuspage.model.IncidentStatus;
import com.statuspage.model.ServiceStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class StatusTransitionRequest {
    private IncidentStatus incidentStatus;

    private ServiceStatus serviceStatus;

    @NotNull(message = "操作人不能为空")
    private String operator;

    private String reason;
}