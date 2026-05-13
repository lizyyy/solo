package com.batchqueue.model.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class TaskCancelRequest {
    @NotBlank(message = "任务ID不能为空")
    private String taskId;

    private String reason;

    private String operator;
}
