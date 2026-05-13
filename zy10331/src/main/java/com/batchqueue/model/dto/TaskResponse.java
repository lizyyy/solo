package com.batchqueue.model.dto;

import com.batchqueue.model.enums.TaskPriority;
import com.batchqueue.model.enums.TaskStatus;
import com.batchqueue.model.enums.TaskType;
import lombok.Data;
import lombok.Builder;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class TaskResponse {
    private Long id;
    private String taskId;
    private String taskName;
    private TaskType taskType;
    private TaskPriority priority;
    private TaskStatus status;
    private String payload;
    private String result;
    private String handler;
    private Integer executionSlot;
    private LocalDateTime createdAt;
    private LocalDateTime queuedAt;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
    private Long waitDurationSeconds;
    private Long executionDurationSeconds;
}
