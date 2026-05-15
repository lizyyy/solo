package com.resource.tag.dto;

import com.resource.tag.model.TaskStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskStatusResponse {
    private String taskId;
    private String requestId;
    private String targetNodeId;
    private TaskStatus status;
    private String errorMessage;
    private Integer conflictCount;
    private Integer calculatedTags;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime completedAt;
}
