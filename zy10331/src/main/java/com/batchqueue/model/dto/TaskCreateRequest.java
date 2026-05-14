package com.batchqueue.model.dto;

import com.batchqueue.model.enums.TaskPriority;
import com.batchqueue.model.enums.TaskType;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.Data;

@Data
public class TaskCreateRequest {
    @NotBlank(message = "任务ID不能为空")
    private String taskId;

    @NotBlank(message = "任务名称不能为空")
    private String taskName;

    @NotNull(message = "任务类型不能为空")
    private TaskType taskType;

    @NotNull(message = "任务优先级不能为空")
    private TaskPriority priority;

    private String payload;

    private String handler;
}
