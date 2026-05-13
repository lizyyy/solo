package com.batchqueue.model.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class TaskProgressRequest {
    @NotBlank(message = "任务ID不能为空")
    private String taskId;

    private String result;

    private String operator;
}
