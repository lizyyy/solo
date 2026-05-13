package com.encryption.rotation.model.dto;

import com.encryption.rotation.model.enums.RotationStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RotationReport {
    private String batchId;
    private String batchNumber;
    private String tenantId;
    private RotationStatus status;
    private Integer totalTaskCount;
    private Integer successCount;
    private Integer failedCount;
    private Integer skippedCount;
    private Double successRate;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
    private Long durationInSeconds;
    private String createdBy;
    private String reason;
}
