package com.virusscan.dto;

import com.virusscan.enums.TaskStatus;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.Data;
import org.hibernate.validator.constraints.Length;

@Data
public class TaskStatusUpdateRequest {
    @NotNull(message = "目标状态不能为空")
    private TaskStatus targetStatus;

    private String scanResult;

    private String virusDetails;

    private String errorCode;

    private String errorMessage;

    private String operator;
}