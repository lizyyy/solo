package com.migration.dualwrite.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class RollbackRecord {
    private String rollbackId;
    private LocalDateTime rollbackTime;
    private String operator;
    private String rollbackReason;
    private List<String> rollbackSteps;
    private Boolean rollbackSuccess;
    private String rollbackResult;
}
