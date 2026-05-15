package com.business.recalculate.dto;

import com.business.recalculate.model.RecalculateBatch;
import com.business.recalculate.model.RecalculateStatus;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class BatchDetailResponse {
    private Long id;
    private String batchNo;
    private String batchName;
    private String description;
    private RecalculateStatus status;
    private String statusDisplayName;
    private String statusDescription;
    private Integer totalEventCount;
    private Integer processedEventCount;
    private Integer successEventCount;
    private Integer failedEventCount;
    private String errorCode;
    private String errorMessage;
    private String errorDetail;
    private LocalDateTime statusUpdatedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String createdBy;
    private String updatedBy;
    private EventScopeResponse eventScope;
    private List<ProcessingRuleResponse> processingRules;
    private ComparisonResultResponse comparisonResult;
    private List<StatusHistoryResponse> statusHistory;

    public static BatchDetailResponse fromBatch(RecalculateBatch batch) {
        BatchDetailResponse response = new BatchDetailResponse();
        response.setId(batch.getId());
        response.setBatchNo(batch.getBatchNo());
        response.setBatchName(batch.getBatchName());
        response.setDescription(batch.getDescription());
        response.setStatus(batch.getStatus());
        response.setStatusDisplayName(batch.getStatus().getDisplayName());
        response.setStatusDescription(batch.getStatus().getDescription());
        response.setTotalEventCount(batch.getTotalEventCount());
        response.setProcessedEventCount(batch.getProcessedEventCount());
        response.setSuccessEventCount(batch.getSuccessEventCount());
        response.setFailedEventCount(batch.getFailedEventCount());
        response.setErrorCode(batch.getErrorCode());
        response.setErrorMessage(batch.getErrorMessage());
        response.setErrorDetail(batch.getErrorDetail());
        response.setStatusUpdatedAt(batch.getStatusUpdatedAt());
        response.setCreatedAt(batch.getCreatedAt());
        response.setUpdatedAt(batch.getUpdatedAt());
        response.setCreatedBy(batch.getCreatedBy());
        response.setUpdatedBy(batch.getUpdatedBy());
        return response;
    }

    @Data
    public static class EventScopeResponse {
        private String scopeType;
        private LocalDateTime startTime;
        private LocalDateTime endTime;
        private List<String> eventTypes;
        private List<String> businessIds;
        private String filterExpression;
        private Integer estimatedEventCount;
    }

    @Data
    public static class ProcessingRuleResponse {
        private Long id;
        private String ruleCode;
        private String ruleName;
        private String ruleVersion;
        private String ruleDescription;
    }

    @Data
    public static class ComparisonResultResponse {
        private Integer totalComparedCount;
        private Integer identicalCount;
        private Integer differentCount;
        private Integer newCount;
        private Integer missingCount;
        private String differenceSummary;
        private Boolean passed;
    }

    @Data
    public static class StatusHistoryResponse {
        private RecalculateStatus previousStatus;
        private String previousStatusName;
        private RecalculateStatus currentStatus;
        private String currentStatusName;
        private String remark;
        private String operator;
        private LocalDateTime createdAt;
    }
}
