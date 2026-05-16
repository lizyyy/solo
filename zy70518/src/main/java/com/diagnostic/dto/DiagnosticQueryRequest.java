package com.diagnostic.dto;

import com.diagnostic.enums.DiagnosticStatus;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class DiagnosticQueryRequest {
    private String instanceId;
    private String poolName;
    private DiagnosticStatus status;
    private Boolean suspectedLeak;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Integer pageNum = 1;
    private Integer pageSize = 20;
}