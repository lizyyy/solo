package com.infrastructure.drain.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.Size;
import java.util.List;

@Data
public class CreateDrainBatchRequest {
    
    @NotBlank(message = "批次ID不能为空")
    @Size(max = 64, message = "批次ID长度不能超过64")
    private String batchId;
    
    @NotBlank(message = "操作人不能为空")
    @Size(max = 128, message = "操作人长度不能超过128")
    private String operator;
    
    @Size(max = 512, message = "原因长度不能超过512")
    private String reason;
    
    @NotEmpty(message = "实例列表不能为空")
    private List<InstanceInfo> instances;
    
    @Data
    public static class InstanceInfo {
        @NotBlank(message = "实例ID不能为空")
        @Size(max = 128, message = "实例ID长度不能超过128")
        private String instanceId;
        
        @NotBlank(message = "服务名不能为空")
        @Size(max = 128, message = "服务名长度不能超过128")
        private String serviceName;
        
        @Size(max = 64, message = "IP长度不能超过64")
        private String ip;
        
        private Integer port;
        
        @Size(max = 256, message = "端点长度不能超过256")
        private String endpoint;
    }
}
