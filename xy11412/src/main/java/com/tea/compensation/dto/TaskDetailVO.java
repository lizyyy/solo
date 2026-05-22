package com.tea.compensation.dto;

import com.tea.compensation.entity.CompensationTask;
import com.tea.compensation.entity.TaskItem;
import com.tea.compensation.enums.TaskStatus;
import com.tea.compensation.enums.TaskType;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class TaskDetailVO {
    private Long id;
    private String batchNo;
    private String storeId;
    private String storeName;
    private TaskType taskType;
    private String taskTypeDesc;
    private TaskStatus status;
    private String statusDesc;
    private String statusRemark;
    private String taskContent;
    private BigDecimal totalAmount;
    private Integer totalCount;
    private Integer successCount;
    private Integer failCount;
    private Integer retryCount;
    private Integer maxRetryCount;
    private LocalDateTime nextRetryTime;
    private String externalReceiptNo;
    private LocalDateTime receiptTime;
    private String submitter;
    private String currentHandler;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String failReason;
    private Boolean canRetry;
    private Boolean isFrozen;
    private Boolean isFinal;
    private List<TaskItemVO> items;
    private List<OperationLogVO> recentLogs;
    private List<AuditHistoryVO> recentAudits;

    @Data
    public static class TaskItemVO {
        private Long id;
        private String itemNo;
        private String materialName;
        private String materialCode;
        private BigDecimal quantity;
        private String unit;
        private BigDecimal unitPrice;
        private BigDecimal amount;
        private TaskStatus status;
        private String statusDesc;
        private String failReason;
        private String externalId;
        private String remark;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }

    @Data
    public static class OperationLogVO {
        private Long id;
        private String operationType;
        private String operationTypeDesc;
        private String beforeStatus;
        private String afterStatus;
        private String changeSummary;
        private String operator;
        private String operatorName;
        private String remark;
        private LocalDateTime operationTime;
    }

    @Data
    public static class AuditHistoryVO {
        private Long id;
        private String fieldName;
        private String fieldLabel;
        private String oldValue;
        private String newValue;
        private String modifiedBy;
        private String modifiedByName;
        private LocalDateTime modifiedAt;
        private String changeReason;
    }

    public static TaskDetailVO fromEntity(CompensationTask task) {
        TaskDetailVO vo = new TaskDetailVO();
        vo.setId(task.getId());
        vo.setBatchNo(task.getBatchNo());
        vo.setStoreId(task.getStoreId());
        vo.setStoreName(task.getStoreName());
        vo.setTaskType(task.getTaskType());
        vo.setTaskTypeDesc(task.getTaskType().getDescription());
        vo.setStatus(task.getStatus());
        vo.setStatusDesc(task.getStatus().getDescription());
        vo.setStatusRemark(task.getStatusRemark());
        vo.setTaskContent(task.getTaskContent());
        vo.setTotalAmount(task.getTotalAmount());
        vo.setTotalCount(task.getTotalCount());
        vo.setSuccessCount(task.getSuccessCount());
        vo.setFailCount(task.getFailCount());
        vo.setRetryCount(task.getRetryCount());
        vo.setMaxRetryCount(task.getMaxRetryCount());
        vo.setNextRetryTime(task.getNextRetryTime());
        vo.setExternalReceiptNo(task.getExternalReceiptNo());
        vo.setReceiptTime(task.getReceiptTime());
        vo.setSubmitter(task.getSubmitter());
        vo.setCurrentHandler(task.getCurrentHandler());
        vo.setCreatedAt(task.getCreatedAt());
        vo.setUpdatedAt(task.getUpdatedAt());
        vo.setFailReason(task.getFailReason());
        vo.setCanRetry(task.canRetry());
        vo.setIsFrozen(task.isFrozen());
        vo.setIsFinal(task.isFinal());
        return vo;
    }

    public static TaskItemVO fromItemEntity(TaskItem item) {
        TaskItemVO vo = new TaskItemVO();
        vo.setId(item.getId());
        vo.setItemNo(item.getItemNo());
        vo.setMaterialName(item.getMaterialName());
        vo.setMaterialCode(item.getMaterialCode());
        vo.setQuantity(item.getQuantity());
        vo.setUnit(item.getUnit());
        vo.setUnitPrice(item.getUnitPrice());
        vo.setAmount(item.getAmount());
        vo.setStatus(item.getStatus());
        vo.setStatusDesc(item.getStatus().getDescription());
        vo.setFailReason(item.getFailReason());
        vo.setExternalId(item.getExternalId());
        vo.setRemark(item.getRemark());
        vo.setCreatedAt(item.getCreatedAt());
        vo.setUpdatedAt(item.getUpdatedAt());
        return vo;
    }
}
