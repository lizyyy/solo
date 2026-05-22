package com.tea.compensation.service;

import com.tea.compensation.dto.TaskDetailVO;
import com.tea.compensation.dto.TaskQueryDTO;
import com.tea.compensation.dto.TaskSubmitDTO;
import com.tea.compensation.entity.CompensationTask;
import com.tea.compensation.entity.TaskItem;
import com.tea.compensation.enums.DuplicateStrategy;
import com.tea.compensation.enums.TaskStatus;
import com.tea.compensation.exception.BusinessException;
import com.tea.compensation.repository.CompensationTaskRepository;
import com.tea.compensation.repository.TaskItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CompensationTaskService {

    private final CompensationTaskRepository taskRepository;
    private final TaskItemRepository taskItemRepository;
    private final OperationLogService operationLogService;
    private final AuditHistoryService auditHistoryService;
    private final DeadLetterService deadLetterService;

    @Value("${compensation.queue.max-retry-count:5}")
    private int defaultMaxRetryCount;

    @Value("${compensation.queue.retry-interval-minutes:5}")
    private int retryIntervalMinutes;

    @Value("${compensation.queue.dead-letter-after-hours:24}")
    private int deadLetterAfterHours;

    @Transactional
    public CompensationTask submitTask(TaskSubmitDTO dto, String operator, String operatorName, String ipAddress) {
        log.info("提交任务，批次号: {}, 门店: {}, 类型: {}", dto.getBatchNo(), dto.getStoreName(), dto.getTaskType());

        Optional<CompensationTask> existingTask = taskRepository.findByBatchNo(dto.getBatchNo());
        
        if (existingTask.isPresent()) {
            CompensationTask task = existingTask.get();
            log.warn("批次号已存在，策略: {}", dto.getDuplicateStrategy());
            
            switch (dto.getDuplicateStrategy()) {
                case IGNORE:
                    throw BusinessException.of(409, "批次号已存在，已忽略重复提交");
                case OVERWRITE:
                    return overwriteTask(task, dto, operator, operatorName, ipAddress);
                case APPEND:
                    return appendTask(task, dto, operator, operatorName, ipAddress);
                default:
                    throw BusinessException.of(400, "未知的重复处理策略");
            }
        }

        CompensationTask task = createNewTask(dto, operator);
        task = taskRepository.save(task);

        List<TaskItem> items = createTaskItems(task, dto.getItems(), operator);
        taskItemRepository.saveAll(items);

        updateTaskCounts(task);

        operationLogService.logSubmit(task, operator, operatorName, ipAddress);

        log.info("任务提交成功，ID: {}, 批次号: {}", task.getId(), task.getBatchNo());
        return task;
    }

    private CompensationTask createNewTask(TaskSubmitDTO dto, String operator) {
        CompensationTask task = new CompensationTask();
        task.setBatchNo(dto.getBatchNo());
        task.setStoreId(dto.getStoreId());
        task.setStoreName(dto.getStoreName());
        task.setTaskType(dto.getTaskType());
        task.setStatus(TaskStatus.QUEUED);
        task.setTaskContent(dto.getTaskContent());
        task.setTotalAmount(dto.getTotalAmount());
        task.setTotalCount(dto.getItems().size());
        task.setSuccessCount(0);
        task.setFailCount(0);
        task.setRetryCount(0);
        task.setMaxRetryCount(defaultMaxRetryCount);
        task.setNextRetryTime(LocalDateTime.now().plusMinutes(retryIntervalMinutes));
        task.setExternalReceiptNo(dto.getExternalReceiptNo());
        task.setDuplicateStrategy(dto.getDuplicateStrategy());
        task.setParentBatchNo(dto.getParentBatchNo());
        task.setSubmitter(operator);
        task.setCreator(operator);
        task.setLastModifier(operator);
        return task;
    }

    private List<TaskItem> createTaskItems(CompensationTask task, List<TaskSubmitDTO.TaskItemDTO> itemDTOs, String operator) {
        List<TaskItem> items = new ArrayList<>();
        for (TaskSubmitDTO.TaskItemDTO itemDTO : itemDTOs) {
            TaskItem item = new TaskItem();
            item.setTaskId(task.getId());
            item.setBatchNo(task.getBatchNo());
            item.setItemNo(itemDTO.getItemNo());
            item.setMaterialName(itemDTO.getMaterialName());
            item.setMaterialCode(itemDTO.getMaterialCode());
            item.setQuantity(itemDTO.getQuantity());
            item.setUnit(itemDTO.getUnit());
            item.setUnitPrice(itemDTO.getUnitPrice());
            item.setAmount(itemDTO.getAmount());
            item.setStatus(TaskStatus.QUEUED);
            item.setExternalId(itemDTO.getExternalId());
            item.setRemark(itemDTO.getRemark());
            item.setCreator(operator);
            item.setLastModifier(operator);
            items.add(item);
        }
        return items;
    }

    @Transactional
    public CompensationTask overwriteTask(CompensationTask existingTask, TaskSubmitDTO dto, String operator, String operatorName, String ipAddress) {
        if (existingTask.isFinal()) {
            throw BusinessException.of(400, "终态任务不允许覆盖");
        }
        if (existingTask.isFrozen()) {
            throw BusinessException.of(400, "已冻结任务不允许覆盖");
        }

        CompensationTask oldTask = cloneTask(existingTask);

        existingTask.setTaskContent(dto.getTaskContent());
        existingTask.setTotalAmount(dto.getTotalAmount());
        existingTask.setTotalCount(dto.getItems().size());
        existingTask.setStatus(TaskStatus.QUEUED);
        existingTask.setRetryCount(0);
        existingTask.setNextRetryTime(LocalDateTime.now().plusMinutes(retryIntervalMinutes));
        existingTask.setExternalReceiptNo(dto.getExternalReceiptNo());
        existingTask.setLastModifier(operator);
        existingTask.setFailReason(null);

        taskItemRepository.deleteByTaskId(existingTask.getId());

        List<TaskItem> items = createTaskItems(existingTask, dto.getItems(), operator);
        taskItemRepository.saveAll(items);

        updateTaskCounts(existingTask);
        existingTask = taskRepository.save(existingTask);

        auditHistoryService.compareAndRecord(oldTask, existingTask, operator, operatorName, "覆盖任务");
        operationLogService.logStatusChange(existingTask, oldTask.getStatus(), 
                com.tea.compensation.enums.OperationType.RESUBMIT, 
                "覆盖任务，共" + existingTask.getTotalCount() + "条记录", 
                operator, operatorName, "覆盖提交", ipAddress);

        return existingTask;
    }

    @Transactional
    public CompensationTask appendTask(CompensationTask existingTask, TaskSubmitDTO dto, String operator, String operatorName, String ipAddress) {
        if (existingTask.isFinal()) {
            throw BusinessException.of(400, "终态任务不允许追加");
        }
        if (existingTask.isFrozen()) {
            throw BusinessException.of(400, "已冻结任务不允许追加");
        }

        CompensationTask oldTask = cloneTask(existingTask);

        List<TaskItem> existingItems = taskItemRepository.findByTaskId(existingTask.getId());
        List<String> existingItemNos = existingItems.stream()
                .map(TaskItem::getItemNo)
                .collect(Collectors.toList());

        List<TaskSubmitDTO.TaskItemDTO> newItems = dto.getItems().stream()
                .filter(item -> !existingItemNos.contains(item.getItemNo()))
                .collect(Collectors.toList());

        if (newItems.isEmpty()) {
            throw BusinessException.of(400, "没有新的明细可追加");
        }

        List<TaskItem> items = createTaskItems(existingTask, newItems, operator);
        taskItemRepository.saveAll(items);

        existingTask.setTotalCount(existingTask.getTotalCount() + newItems.size());
        if (dto.getTotalAmount() != null && existingTask.getTotalAmount() != null) {
            existingTask.setTotalAmount(existingTask.getTotalAmount().add(dto.getTotalAmount()));
        }
        existingTask.setLastModifier(operator);

        updateTaskCounts(existingTask);
        existingTask = taskRepository.save(existingTask);

        auditHistoryService.compareAndRecord(oldTask, existingTask, operator, operatorName, "追加任务明细");
        operationLogService.logStatusChange(existingTask, oldTask.getStatus(), 
                com.tea.compensation.enums.OperationType.RESUBMIT, 
                "追加任务，新增" + newItems.size() + "条记录", 
                operator, operatorName, "追加提交", ipAddress);

        return existingTask;
    }

    private CompensationTask cloneTask(CompensationTask task) {
        CompensationTask clone = new CompensationTask();
        clone.setId(task.getId());
        clone.setBatchNo(task.getBatchNo());
        clone.setStatus(task.getStatus());
        clone.setTaskContent(task.getTaskContent());
        clone.setTotalAmount(task.getTotalAmount());
        clone.setTotalCount(task.getTotalCount());
        clone.setSuccessCount(task.getSuccessCount());
        clone.setFailCount(task.getFailCount());
        clone.setCurrentHandler(task.getCurrentHandler());
        clone.setExternalReceiptNo(task.getExternalReceiptNo());
        clone.setFailReason(task.getFailReason());
        return clone;
    }

    private void updateTaskCounts(CompensationTask task) {
        long successCount = taskItemRepository.countByTaskIdAndStatus(task.getId(), TaskStatus.SUCCESS);
        long failCount = taskItemRepository.countByTaskIdAndStatus(task.getId(), TaskStatus.FAILED)
                + taskItemRepository.countByTaskIdAndStatus(task.getId(), TaskStatus.PARTIAL_FAILED);
        
        task.setSuccessCount((int) successCount);
        task.setFailCount((int) failCount);
    }

    public CompensationTask getTaskById(Long id) {
        return taskRepository.findById(id)
                .orElseThrow(() -> BusinessException.of(404, "任务不存在"));
    }

    public CompensationTask getTaskByBatchNo(String batchNo) {
        return taskRepository.findByBatchNo(batchNo)
                .orElseThrow(() -> BusinessException.of(404, "任务不存在"));
    }

    public TaskDetailVO getTaskDetail(Long id) {
        CompensationTask task = getTaskById(id);
        TaskDetailVO vo = TaskDetailVO.fromEntity(task);

        List<TaskItem> items = taskItemRepository.findByTaskId(id);
        vo.setItems(items.stream()
                .map(TaskDetailVO::fromItemEntity)
                .collect(Collectors.toList()));

        List<com.tea.compensation.entity.OperationLog> logs = operationLogService.getLogsByTaskId(id);
        vo.setRecentLogs(logs.stream()
                .limit(10)
                .map(this::convertToLogVO)
                .collect(Collectors.toList()));

        List<com.tea.compensation.entity.AuditHistory> audits = auditHistoryService.getHistoryByTaskId(id);
        vo.setRecentAudits(audits.stream()
                .limit(10)
                .map(this::convertToAuditVO)
                .collect(Collectors.toList()));

        return vo;
    }

    private TaskDetailVO.OperationLogVO convertToLogVO(com.tea.compensation.entity.OperationLog log) {
        TaskDetailVO.OperationLogVO vo = new TaskDetailVO.OperationLogVO();
        vo.setId(log.getId());
        vo.setOperationType(log.getOperationType().name());
        vo.setOperationTypeDesc(log.getOperationType().getDescription());
        vo.setBeforeStatus(log.getBeforeStatus() != null ? log.getBeforeStatus().getDescription() : null);
        vo.setAfterStatus(log.getAfterStatus() != null ? log.getAfterStatus().getDescription() : null);
        vo.setChangeSummary(log.getChangeSummary());
        vo.setOperator(log.getOperator());
        vo.setOperatorName(log.getOperatorName());
        vo.setRemark(log.getRemark());
        vo.setOperationTime(log.getOperationTime());
        return vo;
    }

    private TaskDetailVO.AuditHistoryVO convertToAuditVO(com.tea.compensation.entity.AuditHistory audit) {
        TaskDetailVO.AuditHistoryVO vo = new TaskDetailVO.AuditHistoryVO();
        vo.setId(audit.getId());
        vo.setFieldName(audit.getFieldName());
        vo.setFieldLabel(audit.getFieldLabel());
        vo.setOldValue(audit.getOldValue());
        vo.setNewValue(audit.getNewValue());
        vo.setModifiedBy(audit.getModifiedBy());
        vo.setModifiedByName(audit.getModifiedByName());
        vo.setModifiedAt(audit.getModifiedAt());
        vo.setChangeReason(audit.getChangeReason());
        return vo;
    }

    public Page<CompensationTask> queryTasks(TaskQueryDTO dto) {
        Pageable pageable = PageRequest.of(
                dto.getPageNum() - 1,
                dto.getPageSize(),
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        if (dto.getStatuses() != null && !dto.getStatuses().isEmpty()) {
            return taskRepository.findByStatusIn(dto.getStatuses(), pageable);
        }

        return taskRepository.findAll(pageable);
    }

    @Transactional
    public CompensationTask cancelTask(Long id, String operator, String operatorName, String remark, String ipAddress) {
        CompensationTask task = getTaskById(id);
        
        if (task.isFinal()) {
            throw BusinessException.of(400, "终态任务不允许取消");
        }

        TaskStatus beforeStatus = task.getStatus();
        task.setStatus(TaskStatus.CANCELLED);
        task.setLastModifier(operator);
        task = taskRepository.save(task);

        taskItemRepository.updateStatusByTaskId(id, TaskStatus.CANCELLED);

        operationLogService.logCancel(task, operator, operatorName, remark, ipAddress);

        return task;
    }

    @Transactional
    public CompensationTask freezeTask(Long id, String operator, String operatorName, String reason, String ipAddress) {
        CompensationTask task = getTaskById(id);
        
        if (task.isFinal()) {
            throw BusinessException.of(400, "终态任务不允许冻结");
        }
        if (task.isFrozen()) {
            throw BusinessException.of(400, "任务已冻结");
        }

        TaskStatus beforeStatus = task.getStatus();
        task.setStatus(TaskStatus.FROZEN);
        task.setFrozenAt(LocalDateTime.now());
        task.setFrozenBy(operator);
        task.setFrozenReason(reason);
        task.setLastModifier(operator);
        task = taskRepository.save(task);

        operationLogService.logFreeze(task, operator, operatorName, reason, ipAddress);
        auditHistoryService.recordChange(id, task.getBatchNo(), "status", 
                beforeStatus.name(), TaskStatus.FROZEN.name(), 
                operator, operatorName, reason);

        return task;
    }

    @Transactional
    public CompensationTask unfreezeTask(Long id, String operator, String operatorName, String ipAddress) {
        CompensationTask task = getTaskById(id);
        
        if (!task.isFrozen()) {
            throw BusinessException.of(400, "任务未冻结");
        }

        task.setStatus(TaskStatus.PENDING);
        task.setFrozenAt(null);
        task.setFrozenBy(null);
        task.setFrozenReason(null);
        task.setLastModifier(operator);
        task = taskRepository.save(task);

        operationLogService.logUnfreeze(task, operator, operatorName, ipAddress);

        return task;
    }

    @Transactional
    public CompensationTask manualTakeOver(Long id, String operator, String operatorName, String remark, String ipAddress) {
        CompensationTask task = getTaskById(id);
        
        if (task.isFinal()) {
            throw BusinessException.of(400, "终态任务不允许人工接管");
        }
        if (TaskStatus.MANUAL_REVIEW.equals(task.getStatus())) {
            throw BusinessException.of(400, "任务已在人工处理中");
        }

        TaskStatus beforeStatus = task.getStatus();
        task.setStatus(TaskStatus.MANUAL_REVIEW);
        task.setCurrentHandler(operator);
        task.setLastModifier(operator);
        task = taskRepository.save(task);

        operationLogService.logManualTakeOver(task, operator, operatorName, remark, ipAddress);
        auditHistoryService.recordChange(id, task.getBatchNo(), "status", 
                beforeStatus.name(), TaskStatus.MANUAL_REVIEW.name(), 
                operator, operatorName, remark);
        auditHistoryService.recordChange(id, task.getBatchNo(), "currentHandler", 
                null, operator, operator, operatorName, remark);

        return task;
    }

    @Transactional
    public CompensationTask compensate(Long id, String operator, String operatorName, String remark, String ipAddress) {
        CompensationTask task = getTaskById(id);
        
        if (task.isFinal() && !TaskStatus.MANUAL_REVIEW.equals(task.getStatus())) {
            throw BusinessException.of(400, "该状态任务不允许补偿入账");
        }

        TaskStatus beforeStatus = task.getStatus();
        task.setStatus(TaskStatus.COMPENSATED);
        task.setLastModifier(operator);
        task = taskRepository.save(task);

        taskItemRepository.updateStatusByTaskId(id, TaskStatus.COMPENSATED);

        operationLogService.logCompensate(task, operator, operatorName, remark, ipAddress);
        auditHistoryService.recordChange(id, task.getBatchNo(), "status", 
                beforeStatus.name(), TaskStatus.COMPENSATED.name(), 
                operator, operatorName, remark);

        return task;
    }

    @Transactional
    public CompensationTask closeTask(Long id, String operator, String operatorName, String remark, String ipAddress) {
        CompensationTask task = getTaskById(id);
        
        if (TaskStatus.CLOSED.equals(task.getStatus())) {
            throw BusinessException.of(400, "任务已关闭");
        }

        TaskStatus beforeStatus = task.getStatus();
        task.setStatus(TaskStatus.CLOSED);
        task.setLastModifier(operator);
        task = taskRepository.save(task);

        operationLogService.logClose(task, operator, operatorName, remark, ipAddress);
        auditHistoryService.recordChange(id, task.getBatchNo(), "status", 
                beforeStatus.name(), TaskStatus.CLOSED.name(), 
                operator, operatorName, remark);

        return task;
    }

    @Transactional
    public CompensationTask judgeStatus(Long id, TaskStatus newStatus, String operator, String operatorName, String remark, String ipAddress) {
        CompensationTask task = getTaskById(id);
        
        if (TaskStatus.MANUAL_REVIEW.equals(task.getStatus())) {
            throw BusinessException.of(400, "仅人工处理中的任务支持改判");
        }

        TaskStatus beforeStatus = task.getStatus();
        task.setStatus(newStatus);
        task.setLastModifier(operator);
        task = taskRepository.save(task);

        operationLogService.logJudge(task, beforeStatus, operator, operatorName, remark, ipAddress);
        auditHistoryService.recordChange(id, task.getBatchNo(), "status", 
                beforeStatus.name(), newStatus.name(), 
                operator, operatorName, remark);

        return task;
    }

    @Transactional
    public void processRetryTasks() {
        log.info("开始处理重试任务...");
        
        List<CompensationTask> retryableTasks = taskRepository.findAllRetryableTasks(LocalDateTime.now());
        
        for (CompensationTask task : retryableTasks) {
            try {
                retryTask(task);
            } catch (Exception e) {
                log.error("重试任务失败，任务ID: {}", task.getId(), e);
            }
        }
        
        log.info("重试任务处理完成，共处理 {} 个任务", retryableTasks.size());
    }

    @Transactional
    public CompensationTask retryTask(CompensationTask task) {
        if (!task.canRetry()) {
            if (task.getRetryCount() >= task.getMaxRetryCount()) {
                deadLetterService.moveToDeadLetter(task, "超过最大重试次数");
            }
            return task;
        }

        TaskStatus beforeStatus = task.getStatus();
        task.setStatus(TaskStatus.RETRYING);
        task.setRetryCount(task.getRetryCount() + 1);
        task.setNextRetryTime(LocalDateTime.now().plusMinutes(retryIntervalMinutes * (task.getRetryCount() + 1)));
        task.setLastModifier("system");
        task = taskRepository.save(task);

        taskItemRepository.updateStatusByTaskId(task.getId(), TaskStatus.RETRYING);

        operationLogService.logRetry(task, "system", "127.0.0.1");
        auditHistoryService.recordChange(task.getId(), task.getBatchNo(), "status", 
                beforeStatus.name(), TaskStatus.RETRYING.name(), 
                "system", "系统", "自动重试");

        return task;
    }

    @Transactional
    public void processDeadLetterCheck() {
        log.info("开始检查死信任务...");
        
        LocalDateTime deadline = LocalDateTime.now().minusHours(deadLetterAfterHours);
        List<CompensationTask> deadLetterTasks = taskRepository.findTasksForDeadLetter(deadline);
        
        for (CompensationTask task : deadLetterTasks) {
            try {
                deadLetterService.moveToDeadLetter(task, "超时未处理，自动转入死信队列");
            } catch (Exception e) {
                log.error("移入死信队列失败，任务ID: {}", task.getId(), e);
            }
        }
        
        log.info("死信检查完成，共处理 {} 个任务", deadLetterTasks.size());
    }

    public boolean validateDataConsistency(Long id) {
        CompensationTask task = getTaskById(id);
        List<TaskItem> items = taskItemRepository.findByTaskId(id);

        int itemCount = items.size();
        if (task.getTotalCount() != null && task.getTotalCount() != itemCount) {
            log.warn("数据一致性校验失败：总数量不匹配，任务: {}, 明细: {}", task.getTotalCount(), itemCount);
            return false;
        }

        long successCount = items.stream()
                .filter(item -> TaskStatus.SUCCESS.equals(item.getStatus()))
                .count();
        if (task.getSuccessCount() != null && task.getSuccessCount() != successCount) {
            log.warn("数据一致性校验失败：成功数量不匹配，任务: {}, 明细: {}", task.getSuccessCount(), successCount);
            return false;
        }

        long failCount = items.stream()
                .filter(item -> TaskStatus.FAILED.equals(item.getStatus()) 
                        || TaskStatus.PARTIAL_FAILED.equals(item.getStatus()))
                .count();
        if (task.getFailCount() != null && task.getFailCount() != failCount) {
            log.warn("数据一致性校验失败：失败数量不匹配，任务: {}, 明细: {}", task.getFailCount(), failCount);
            return false;
        }

        return true;
    }
}
