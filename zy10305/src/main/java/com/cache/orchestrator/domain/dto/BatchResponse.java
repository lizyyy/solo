package com.cache.orchestrator.domain.dto;

import com.cache.orchestrator.domain.enums.BatchStatus;
import lombok.Data;
import lombok.Builder;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class BatchResponse {

    private Long batchId;
    private String requestId;
    private String keyPattern;
    private Integer totalKeys;
    private Integer totalNodes;
    private BatchStatus status;
    private String errorMessage;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime completedAt;

    private List<KeyInfo> resolvedKeys;
    private List<NodeInfo> nodes;
    private List<ReceiptInfo> receipts;
    private List<FailedNodeInfo> failedNodes;
    private List<RetryInfo> retryPlans;

    private Progress progress;

    @Data
    @Builder
    public static class KeyInfo {
        private String cacheKey;
    }

    @Data
    @Builder
    public static class NodeInfo {
        private String nodeId;
        private String nodeAddress;
        private Integer priority;
    }

    @Data
    @Builder
    public static class ReceiptInfo {
        private String receiptId;
        private String nodeId;
        private String status;
        private String failureReason;
        private Integer keysProcessed;
        private LocalDateTime confirmedAt;
    }

    @Data
    @Builder
    public static class FailedNodeInfo {
        private String nodeId;
        private String failureReason;
        private Integer retryCount;
        private LocalDateTime failedAt;
    }

    @Data
    @Builder
    public static class RetryInfo {
        private String nodeId;
        private Integer retryNumber;
        private Integer maxRetries;
        private Long delaySeconds;
        private LocalDateTime scheduledAt;
        private String result;
    }

    @Data
    @Builder
    public static class Progress {
        private Integer confirmedCount;
        private Integer failedCount;
        private Integer pendingCount;
        private Double completionRate;
    }
}
