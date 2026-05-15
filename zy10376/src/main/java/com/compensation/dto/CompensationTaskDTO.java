package com.compensation.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CompensationTaskDTO {

    private Long id;
    private String taskId;
    private String taskName;
    private Integer taskOrder;
    private String status;
    private String taskData;
    private String taskResult;
    private Integer retryCount;
    private Integer maxRetry;
    private LocalDateTime nextRetryTime;
    private String dependOnTaskIds;
    private String executedBy;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
    private FailureReasonDTO failureReason;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
