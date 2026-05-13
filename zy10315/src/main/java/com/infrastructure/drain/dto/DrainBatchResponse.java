package com.infrastructure.drain.dto;

import com.infrastructure.drain.model.DrainStatus;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class DrainBatchResponse {
    private String batchId;
    private String operator;
    private String reason;
    private DrainStatus status;
    private String errorMessage;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime completedAt;
    private List<InstanceResponse> instances;

    @Data
    public static class InstanceResponse {
        private String instanceId;
        private String serviceName;
        private String ip;
        private Integer port;
        private String endpoint;
        private DrainStatus status;
        private String statusDetail;
        private Integer activeConnections;
        private Integer pendingTasks;
    }
}
