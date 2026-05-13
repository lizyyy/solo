package com.cache.orchestrator.domain.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class CreateBatchRequest {

    @NotBlank(message = "requestId 不能为空")
    private String requestId;

    @NotBlank(message = "keyPattern 不能为空")
    private String keyPattern;

    @NotEmpty(message = "serviceNodes 不能为空")
    private List<NodeInfo> serviceNodes;

    private RetryConfig retryConfig;

    @Data
    public static class NodeInfo {
        @NotBlank(message = "nodeId 不能为空")
        private String nodeId;
        @NotBlank(message = "nodeAddress 不能为空")
        private String nodeAddress;
        private Integer priority;
    }

    @Data
    public static class RetryConfig {
        @NotNull(message = "maxRetries 不能为空")
        private Integer maxRetries;
        @NotNull(message = "delaySeconds 不能为空")
        private Long delaySeconds;
    }
}
