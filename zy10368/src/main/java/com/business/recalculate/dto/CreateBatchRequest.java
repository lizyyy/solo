package com.business.recalculate.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class CreateBatchRequest {
    
    @NotBlank(message = "批次名称不能为空")
    private String batchName;
    
    private String description;
    
    @NotBlank(message = "幂等键不能为空")
    private String idempotencyKey;
    
    @NotNull(message = "事件范围不能为空")
    private EventScopeDto eventScope;
    
    private List<Long> ruleIds;
    
    private String operator;

    @Data
    public static class EventScopeDto {
        @NotBlank(message = "范围类型不能为空")
        private String scopeType;
        
        @NotNull(message = "开始时间不能为空")
        private LocalDateTime startTime;
        
        @NotNull(message = "结束时间不能为空")
        private LocalDateTime endTime;
        
        private List<String> eventTypes;
        
        private List<String> businessIds;
        
        private String filterExpression;
    }
}
