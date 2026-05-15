package com.metadata.repair.dto;

import com.metadata.repair.enums.RepairStatus;
import lombok.Data;
import java.time.LocalDateTime;

@Data
public class BatchResponse {
    private String batchNo;
    private String batchName;
    private RepairStatus status;
    private String operator;
    private String description;
    private Integer totalCount;
    private Integer successCount;
    private Integer failedCount;
    private Integer skippedCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime completedAt;
}
