package com.retry.budget.dto;

import com.retry.budget.enums.FailureType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RetryCheckRequest {
    
    @NotBlank(message = "调用方ID不能为空")
    @Size(max = 100, message = "调用方ID长度不能超过100")
    private String callerId;
    
    @NotBlank(message = "目标API不能为空")
    @Size(max = 200, message = "目标API长度不能超过200")
    private String targetApi;
    
    @NotNull(message = "失败类型不能为空")
    private FailureType failureType;
    
    @Size(max = 1000, message = "失败原因长度不能超过1000")
    private String failureReason;
    
    @Size(max = 64, message = "幂等键长度不能超过64")
    private String idempotentKey;
}
