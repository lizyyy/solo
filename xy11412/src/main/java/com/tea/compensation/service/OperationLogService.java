package com.tea.compensation.service;

import com.tea.compensation.entity.CompensationTask;
import com.tea.compensation.entity.OperationLog;
import com.tea.compensation.enums.OperationType;
import com.tea.compensation.enums.TaskStatus;
import com.tea.compensation.enums.TaskType;
import com.tea.compensation.repository.OperationLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class OperationLogService {

    private final OperationLogRepository operationLogRepository;

    @Transactional
    public OperationLog logOperation(
            Long taskId,
            String batchNo,
            String storeId,
            TaskType taskType,
            OperationType operationType,
            TaskStatus beforeStatus,
            TaskStatus afterStatus,
            String beforeContent,
            String afterContent,
            String changeSummary,
            String operator,
            String operatorName,
            String remark,
            String ipAddress
    ) {
        OperationLog operationLog = new OperationLog();
        operationLog.setTaskId(taskId);
        operationLog.setBatchNo(batchNo);
        operationLog.setStoreId(storeId);
        operationLog.setTaskType(taskType);
        operationLog.setOperationType(operationType);
        operationLog.setBeforeStatus(beforeStatus);
        operationLog.setAfterStatus(afterStatus);
        operationLog.setBeforeContent(beforeContent);
        operationLog.setAfterContent(afterContent);
        operationLog.setChangeSummary(changeSummary);
        operationLog.setOperator(operator);
        operationLog.setOperatorName(operatorName);
        operationLog.setRemark(remark);
        operationLog.setOperationTime(LocalDateTime.now());
        operationLog.setIpAddress(ipAddress);

        return operationLogRepository.save(operationLog);
    }

    @Transactional
    public OperationLog logSubmit(CompensationTask task, String operator, String operatorName, String ipAddress) {
        return logOperation(
                task.getId(),
                task.getBatchNo(),
                task.getStoreId(),
                task.getTaskType(),
                OperationType.SUBMIT,
                null,
                task.getStatus(),
                null,
                task.getTaskContent(),
                "提交任务，共" + task.getTotalCount() + "条记录",
                operator,
                operatorName,
                "任务提交成功",
                ipAddress
        );
    }

    @Transactional
    public OperationLog logStatusChange(
            CompensationTask task,
            TaskStatus beforeStatus,
            OperationType operationType,
            String changeSummary,
            String operator,
            String operatorName,
            String remark,
            String ipAddress
    ) {
        return logOperation(
                task.getId(),
                task.getBatchNo(),
                task.getStoreId(),
                task.getTaskType(),
                operationType,
                beforeStatus,
                task.getStatus(),
                beforeStatus != null ? beforeStatus.getDescription() : null,
                task.getStatus().getDescription(),
                changeSummary,
                operator,
                operatorName,
                remark,
                ipAddress
        );
    }

    @Transactional
    public OperationLog logRetry(CompensationTask task, String operator, String ipAddress) {
        return logOperation(
                task.getId(),
                task.getBatchNo(),
                task.getStoreId(),
                task.getTaskType(),
                OperationType.RETRY,
                TaskStatus.FAILED,
                TaskStatus.RETRYING,
                null,
                null,
                "第" + (task.getRetryCount() + 1) + "次重试",
                operator,
                operator,
                "自动重试",
                ipAddress
        );
    }

    @Transactional
    public OperationLog logManualTakeOver(CompensationTask task, String operator, String operatorName, String remark, String ipAddress) {
        return logOperation(
                task.getId(),
                task.getBatchNo(),
                task.getStoreId(),
                task.getTaskType(),
                OperationType.MANUAL_TAKE_OVER,
                task.getStatus(),
                TaskStatus.MANUAL_REVIEW,
                null,
                null,
                "任务转人工处理，处理人：" + operatorName,
                operator,
                operatorName,
                remark,
                ipAddress
        );
    }

    @Transactional
    public OperationLog logCompensate(CompensationTask task, String operator, String operatorName, String remark, String ipAddress) {
        return logOperation(
                task.getId(),
                task.getBatchNo(),
                task.getStoreId(),
                task.getTaskType(),
                OperationType.COMPENSATE,
                task.getStatus(),
                TaskStatus.COMPENSATED,
                null,
                null,
                "补偿入账成功",
                operator,
                operatorName,
                remark,
                ipAddress
        );
    }

    @Transactional
    public OperationLog logClose(CompensationTask task, String operator, String operatorName, String remark, String ipAddress) {
        return logOperation(
                task.getId(),
                task.getBatchNo(),
                task.getStoreId(),
                task.getTaskType(),
                OperationType.CLOSE,
                task.getStatus(),
                TaskStatus.CLOSED,
                null,
                null,
                "任务关闭",
                operator,
                operatorName,
                remark,
                ipAddress
        );
    }

    @Transactional
    public OperationLog logFreeze(CompensationTask task, String operator, String operatorName, String reason, String ipAddress) {
        return logOperation(
                task.getId(),
                task.getBatchNo(),
                task.getStoreId(),
                task.getTaskType(),
                OperationType.FREEZE,
                task.getStatus(),
                TaskStatus.FROZEN,
                null,
                null,
                "冻结任务，原因：" + reason,
                operator,
                operatorName,
                reason,
                ipAddress
        );
    }

    @Transactional
    public OperationLog logUnfreeze(CompensationTask task, String operator, String operatorName, String ipAddress) {
        return logOperation(
                task.getId(),
                task.getBatchNo(),
                task.getStoreId(),
                task.getTaskType(),
                OperationType.UNFREEZE,
                TaskStatus.FROZEN,
                TaskStatus.PENDING,
                null,
                null,
                "解冻任务",
                operator,
                operatorName,
                null,
                ipAddress
        );
    }

    @Transactional
    public OperationLog logCancel(CompensationTask task, String operator, String operatorName, String remark, String ipAddress) {
        return logOperation(
                task.getId(),
                task.getBatchNo(),
                task.getStoreId(),
                task.getTaskType(),
                OperationType.CANCEL,
                task.getStatus(),
                TaskStatus.CANCELLED,
                null,
                null,
                "取消/撤回任务",
                operator,
                operatorName,
                remark,
                ipAddress
        );
    }

    @Transactional
    public OperationLog logJudge(CompensationTask task, TaskStatus beforeStatus, String operator, String operatorName, String remark, String ipAddress) {
        return logOperation(
                task.getId(),
                task.getBatchNo(),
                task.getStoreId(),
                task.getTaskType(),
                OperationType.JUDGE,
                beforeStatus,
                task.getStatus(),
                null,
                null,
                "人工改判状态",
                operator,
                operatorName,
                remark,
                ipAddress
        );
    }

    @Transactional
    public OperationLog logExport(CompensationTask task, String operator, String operatorName, String ipAddress) {
        return logOperation(
                task.getId(),
                task.getBatchNo(),
                task.getStoreId(),
                task.getTaskType(),
                OperationType.EXPORT,
                task.getStatus(),
                task.getStatus(),
                null,
                null,
                "导出任务数据",
                operator,
                operatorName,
                null,
                ipAddress
        );
    }

    @Transactional
    public OperationLog logRecover(CompensationTask task, String operator, String operatorName, String ipAddress) {
        return logOperation(
                task.getId(),
                task.getBatchNo(),
                task.getStoreId(),
                task.getTaskType(),
                OperationType.RECOVER,
                TaskStatus.DEAD_LETTER,
                TaskStatus.PENDING,
                null,
                null,
                "从死信队列恢复",
                operator,
                operatorName,
                null,
                ipAddress
        );
    }

    public List<OperationLog> getLogsByTaskId(Long taskId) {
        return operationLogRepository.findByTaskIdOrderByOperationTimeDesc(taskId);
    }

    public List<OperationLog> getLogsByBatchNo(String batchNo) {
        return operationLogRepository.findByBatchNoOrderByOperationTimeDesc(batchNo);
    }
}
