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
    private List<ActionLogResponse> actionLogs;
    private List<OffloadResultResponse> offloadResults;
    private List<ConnectionResponse> connections;
    private List<TaskResponse> tasks;
    private List<RecoveryActionResponse> recoveryActions;

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
        private LocalDateTime trafficOffloadedAt;
        private LocalDateTime drainedAt;
    }

    @Data
    public static class ActionLogResponse {
        private String batchId;
        private String instanceId;
        private String operator;
        private DrainStatus fromStatus;
        private DrainStatus toStatus;
        private String remark;
        private LocalDateTime actionTime;
    }

    @Data
    public static class OffloadResultResponse {
        private String instanceId;
        private Boolean success;
        private String message;
        private Integer initialConnections;
        private Integer finalConnections;
        private Integer initialTasks;
        private Integer finalTasks;
        private Long durationSeconds;
        private LocalDateTime createdAt;
    }

    @Data
    public static class ConnectionResponse {
        private String connectionId;
        private String instanceId;
        private String clientIp;
        private Integer clientPort;
        private String protocol;
        private String status;
        private LocalDateTime connectedAt;
        private LocalDateTime lastActiveAt;
        private Long durationSeconds;
    }

    @Data
    public static class TaskResponse {
        private String taskId;
        private String instanceId;
        private String queueName;
        private String taskType;
        private String status;
        private String targetInstanceId;
        private LocalDateTime createdAt;
        private LocalDateTime migratedAt;
    }

    @Data
    public static class RecoveryActionResponse {
        private String batchId;
        private String instanceId;
        private String operator;
        private String actionType;
        private String reason;
        private String actionDetail;
        private Boolean success;
        private String errorMessage;
        private LocalDateTime actionTime;
    }
}
