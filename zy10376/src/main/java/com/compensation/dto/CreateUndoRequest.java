package com.compensation.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class CreateUndoRequest {
    
    @NotBlank(message = "请求ID不能为空")
    @Size(max = 64, message = "请求ID长度不能超过64")
    private String requestId;
    
    @NotBlank(message = "业务类型不能为空")
    @Size(max = 128, message = "业务类型长度不能超过128")
    private String businessType;
    
    @Size(max = 512, message = "业务KEY长度不能超过512")
    private String businessKey;
    
    @Size(max = 1024, message = "描述长度不能超过1024")
    private String description;
    
    private String requestData;
    
    private Integer maxRetry;
    
    private LocalDateTime expireTime;
    
    private String callbackUrl;
    
    private List<ActionDefinition> actions;
    
    @Data
    public static class ActionDefinition {
        @NotBlank(message = "动作ID不能为空")
        private String actionId;
        
        @NotBlank(message = "动作名称不能为空")
        private String actionName;
        
        private Integer actionOrder;
        
        private String inputData;
        
        private List<ItemDefinition> items;
    }
    
    @Data
    public static class ItemDefinition {
        @NotBlank(message = "项ID不能为空")
        private String itemId;
        
        @NotBlank(message = "项类型不能为空")
        private String itemType;
        
        @NotBlank(message = "项KEY不能为空")
        private String itemKey;
        
        private String itemDescription;
        
        private String beforeState;
        
        private String afterState;
        
        private Boolean revocable;
        
        private String compensationMethod;
        
        private String compensationParams;
    }
}
