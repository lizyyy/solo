package com.retry.budget.dto;

import com.retry.budget.enums.BackoffStrategy;
import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class CreateBudgetRequest {
    
    @NotBlank(message = "调用方ID不能为空")
    @Size(max = 100, message = "调用方ID长度不能超过100")
    private String callerId;
    
    @NotBlank(message = "目标API不能为空")
    @Size(max = 200, message = "目标API长度不能超过200")
    private String targetApi;
    
    @NotNull(message = "总预算不能为空")
    @Min(value = 1, message = "总预算必须大于0")
    @Max(value = 10000, message = "总预算不能超过10000")
    private Integer totalBudget;
    
    @NotNull(message = "退避策略不能为空")
    private BackoffStrategy backoffStrategy;
    
    @NotNull(message = "初始退避时间不能为空")
    @Min(value = 1, message = "初始退避时间必须大于0")
    private Long initialBackoffMs;
    
    @NotNull(message = "最大退避时间不能为空")
    @Min(value = 1, message = "最大退避时间必须大于0")
    private Long maxBackoffMs;
    
    @NotNull(message = "退避乘数不能为空")
    @DecimalMin(value = "1.0", message = "退避乘数必须大于等于1")
    private Double backoffMultiplier;
    
    @NotNull(message = "恢复间隔不能为空")
    @Min(value = 1000, message = "恢复间隔必须大于等于1000毫秒")
    private Long recoveryIntervalMs;
}
