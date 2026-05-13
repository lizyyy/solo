package com.migration.dualwrite.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class SwitchConclusion {
    private Boolean switchAllowed;
    private String conclusion;
    private LocalDateTime conclusionTime;
    private String approvedBy;
    private List<String> switchConditions;
    private List<String> blockingIssues;
    private String riskLevel;
    private String rollbackPlan;
}
