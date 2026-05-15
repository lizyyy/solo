package com.metadata.repair.dto;

import com.metadata.repair.entity.RepairException;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class RepairReport {
    private String batchNo;
    private String batchName;
    private String status;
    private String operator;
    private Integer totalCount;
    private Integer successCount;
    private Integer failedCount;
    private Integer skippedCount;
    private Double successRate;
    private List<String> successFiles;
    private List<String> skippedFiles;
    private List<RepairException> exceptions;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Long durationSeconds;
}
