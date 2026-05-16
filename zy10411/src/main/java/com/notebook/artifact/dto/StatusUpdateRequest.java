package com.notebook.artifact.dto;

import com.notebook.artifact.model.ExecutionStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class StatusUpdateRequest {
    @NotNull(message = "status不能为空")
    private ExecutionStatus status;
    private String executionLog;
    private String updatedBy;
}
