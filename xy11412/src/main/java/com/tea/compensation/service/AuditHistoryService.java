package com.tea.compensation.service;

import com.tea.compensation.entity.AuditHistory;
import com.tea.compensation.entity.CompensationTask;
import com.tea.compensation.repository.AuditHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditHistoryService {

    private final AuditHistoryRepository auditHistoryRepository;

    private static final Map<String, String> FIELD_LABELS = new HashMap<>();

    static {
        FIELD_LABELS.put("status", "状态");
        FIELD_LABELS.put("statusRemark", "状态备注");
        FIELD_LABELS.put("taskContent", "任务内容");
        FIELD_LABELS.put("totalAmount", "总金额");
        FIELD_LABELS.put("totalCount", "总数量");
        FIELD_LABELS.put("currentHandler", "当前处理人");
        FIELD_LABELS.put("externalReceiptNo", "外部回执号");
        FIELD_LABELS.put("failReason", "失败原因");
        FIELD_LABELS.put("maxRetryCount", "最大重试次数");
    }

    @Transactional
    public AuditHistory recordChange(
            Long taskId,
            String batchNo,
            String fieldName,
            String oldValue,
            String newValue,
            String modifiedBy,
            String modifiedByName,
            String changeReason
    ) {
        if (Objects.equals(oldValue, newValue)) {
            return null;
        }

        AuditHistory audit = new AuditHistory();
        audit.setTaskId(taskId);
        audit.setBatchNo(batchNo);
        audit.setFieldName(fieldName);
        audit.setFieldLabel(FIELD_LABELS.getOrDefault(fieldName, fieldName));
        audit.setOldValue(oldValue);
        audit.setNewValue(newValue);
        audit.setModifiedBy(modifiedBy);
        audit.setModifiedByName(modifiedByName);
        audit.setModifiedAt(LocalDateTime.now());
        audit.setChangeReason(changeReason);

        return auditHistoryRepository.save(audit);
    }

    @Transactional
    public void compareAndRecord(
            CompensationTask oldTask,
            CompensationTask newTask,
            String modifiedBy,
            String modifiedByName,
            String changeReason
    ) {
        if (!Objects.equals(oldTask.getStatus(), newTask.getStatus())) {
            recordChange(
                    newTask.getId(),
                    newTask.getBatchNo(),
                    "status",
                    oldTask.getStatus() != null ? oldTask.getStatus().name() : null,
                    newTask.getStatus() != null ? newTask.getStatus().name() : null,
                    modifiedBy,
                    modifiedByName,
                    changeReason
            );
        }

        if (!Objects.equals(oldTask.getStatusRemark(), newTask.getStatusRemark())) {
            recordChange(
                    newTask.getId(),
                    newTask.getBatchNo(),
                    "statusRemark",
                    oldTask.getStatusRemark(),
                    newTask.getStatusRemark(),
                    modifiedBy,
                    modifiedByName,
                    changeReason
            );
        }

        if (!Objects.equals(oldTask.getTaskContent(), newTask.getTaskContent())) {
            recordChange(
                    newTask.getId(),
                    newTask.getBatchNo(),
                    "taskContent",
                    oldTask.getTaskContent(),
                    newTask.getTaskContent(),
                    modifiedBy,
                    modifiedByName,
                    changeReason
            );
        }

        if (compareBigDecimal(oldTask.getTotalAmount(), newTask.getTotalAmount())) {
            recordChange(
                    newTask.getId(),
                    newTask.getBatchNo(),
                    "totalAmount",
                    oldTask.getTotalAmount() != null ? oldTask.getTotalAmount().toString() : null,
                    newTask.getTotalAmount() != null ? newTask.getTotalAmount().toString() : null,
                    modifiedBy,
                    modifiedByName,
                    changeReason
            );
        }

        if (!Objects.equals(oldTask.getTotalCount(), newTask.getTotalCount())) {
            recordChange(
                    newTask.getId(),
                    newTask.getBatchNo(),
                    "totalCount",
                    oldTask.getTotalCount() != null ? oldTask.getTotalCount().toString() : null,
                    newTask.getTotalCount() != null ? newTask.getTotalCount().toString() : null,
                    modifiedBy,
                    modifiedByName,
                    changeReason
            );
        }

        if (!Objects.equals(oldTask.getCurrentHandler(), newTask.getCurrentHandler())) {
            recordChange(
                    newTask.getId(),
                    newTask.getBatchNo(),
                    "currentHandler",
                    oldTask.getCurrentHandler(),
                    newTask.getCurrentHandler(),
                    modifiedBy,
                    modifiedByName,
                    changeReason
            );
        }

        if (!Objects.equals(oldTask.getExternalReceiptNo(), newTask.getExternalReceiptNo())) {
            recordChange(
                    newTask.getId(),
                    newTask.getBatchNo(),
                    "externalReceiptNo",
                    oldTask.getExternalReceiptNo(),
                    newTask.getExternalReceiptNo(),
                    modifiedBy,
                    modifiedByName,
                    changeReason
            );
        }

        if (!Objects.equals(oldTask.getFailReason(), newTask.getFailReason())) {
            recordChange(
                    newTask.getId(),
                    newTask.getBatchNo(),
                    "failReason",
                    oldTask.getFailReason(),
                    newTask.getFailReason(),
                    modifiedBy,
                    modifiedByName,
                    changeReason
            );
        }
    }

    private boolean compareBigDecimal(BigDecimal a, BigDecimal b) {
        if (a == null && b == null) {
            return false;
        }
        if (a == null || b == null) {
            return true;
        }
        return a.compareTo(b) != 0;
    }

    public List<AuditHistory> getHistoryByTaskId(Long taskId) {
        return auditHistoryRepository.findByTaskIdOrderByModifiedAtDesc(taskId);
    }

    public List<AuditHistory> getHistoryByBatchNo(String batchNo) {
        return auditHistoryRepository.findByBatchNoOrderByModifiedAtDesc(batchNo);
    }
}
