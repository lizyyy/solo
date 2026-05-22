package com.tea.compensation.service;

import com.tea.compensation.entity.CompensationTask;
import com.tea.compensation.entity.DeadLetter;
import com.tea.compensation.entity.TaskItem;
import com.tea.compensation.enums.TaskStatus;
import com.tea.compensation.exception.BusinessException;
import com.tea.compensation.repository.CompensationTaskRepository;
import com.tea.compensation.repository.DeadLetterRepository;
import com.tea.compensation.repository.TaskItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class DeadLetterService {

    private final DeadLetterRepository deadLetterRepository;
    private final CompensationTaskRepository taskRepository;
    private final TaskItemRepository taskItemRepository;
    private final OperationLogService operationLogService;
    private final AuditHistoryService auditHistoryService;

    @Transactional
    public DeadLetter moveToDeadLetter(CompensationTask task, String reason) {
        log.info("将任务移入死信队列，批次号: {}, 原因: {}", task.getBatchNo(), reason);

        if (deadLetterRepository.existsByBatchNo(task.getBatchNo())) {
            log.warn("批次号已在死信队列中: {}", task.getBatchNo());
            return deadLetterRepository.findByBatchNo(task.getBatchNo()).get();
        }

        DeadLetter deadLetter = new DeadLetter();
        deadLetter.setBatchNo(task.getBatchNo());
        deadLetter.setStoreId(task.getStoreId());
        deadLetter.setStoreName(task.getStoreName());
        deadLetter.setTaskType(task.getTaskType());
        deadLetter.setTaskContent(task.getTaskContent());
        deadLetter.setTotalAmount(task.getTotalAmount());
        deadLetter.setTotalCount(task.getTotalCount());
        deadLetter.setRetryCount(task.getRetryCount());
        deadLetter.setFailReason(task.getFailReason());
        deadLetter.setLastError(reason);
        deadLetter.setDeadLetterTime(LocalDateTime.now());
        deadLetter.setRecovered(false);
        deadLetter.setCreator("system");

        deadLetter = deadLetterRepository.save(deadLetter);

        TaskStatus beforeStatus = task.getStatus();
        task.setStatus(TaskStatus.DEAD_LETTER);
        task.setLastModifier("system");
        taskRepository.save(task);

        taskItemRepository.updateStatusByTaskId(task.getId(), TaskStatus.DEAD_LETTER);

        auditHistoryService.recordChange(task.getId(), task.getBatchNo(), "status", 
                beforeStatus.name(), TaskStatus.DEAD_LETTER.name(), 
                "system", "系统", reason);

        log.info("任务已移入死信队列，死信ID: {}", deadLetter.getId());
        return deadLetter;
    }

    @Transactional
    public CompensationTask recoverFromDeadLetter(Long deadLetterId, String operator, String operatorName, String ipAddress) {
        log.info("从死信队列恢复任务，死信ID: {}, 操作人: {}", deadLetterId, operator);

        DeadLetter deadLetter = deadLetterRepository.findById(deadLetterId)
                .orElseThrow(() -> BusinessException.of(404, "死信记录不存在"));

        if (deadLetter.getRecovered()) {
            throw BusinessException.of(400, "该死信已被恢复");
        }

        CompensationTask task = taskRepository.findByBatchNo(deadLetter.getBatchNo())
                .orElseThrow(() -> BusinessException.of(404, "任务不存在"));

        String newBatchNo = generateNewBatchNo(deadLetter.getBatchNo());

        deadLetter.setRecovered(true);
        deadLetter.setRecoveredAt(LocalDateTime.now());
        deadLetter.setRecoveredBy(operator);
        deadLetter.setNewBatchNo(newBatchNo);
        deadLetter.setHandledBy(operator);
        deadLetter.setHandledAt(LocalDateTime.now());
        deadLetter.setHandleRemark("已恢复为新任务: " + newBatchNo);
        deadLetterRepository.save(deadLetter);

        TaskStatus beforeStatus = task.getStatus();
        task.setStatus(TaskStatus.PENDING);
        task.setRetryCount(0);
        task.setNextRetryTime(LocalDateTime.now());
        task.setLastModifier(operator);
        task.setParentBatchNo(task.getBatchNo());
        task.setBatchNo(newBatchNo);
        task = taskRepository.save(task);

        List<TaskItem> items = taskItemRepository.findByTaskId(task.getId());
        for (TaskItem item : items) {
            item.setBatchNo(newBatchNo);
            item.setStatus(TaskStatus.PENDING);
            item.setLastModifier(operator);
        }
        taskItemRepository.saveAll(items);

        operationLogService.logRecover(task, operator, operatorName, ipAddress);
        auditHistoryService.recordChange(task.getId(), newBatchNo, "status", 
                beforeStatus.name(), TaskStatus.PENDING.name(), 
                operator, operatorName, "从死信队列恢复");
        auditHistoryService.recordChange(task.getId(), newBatchNo, "batchNo", 
                deadLetter.getBatchNo(), newBatchNo, 
                operator, operatorName, "死信恢复生成新批次号");

        log.info("死信恢复成功，新批次号: {}", newBatchNo);
        return task;
    }

    private String generateNewBatchNo(String oldBatchNo) {
        String suffix = "_R" + System.currentTimeMillis() % 10000;
        return oldBatchNo.length() > 50 ? 
                oldBatchNo.substring(0, 50) + suffix : 
                oldBatchNo + suffix;
    }

    public DeadLetter getDeadLetterById(Long id) {
        return deadLetterRepository.findById(id)
                .orElseThrow(() -> BusinessException.of(404, "死信记录不存在"));
    }

    public DeadLetter getDeadLetterByBatchNo(String batchNo) {
        return deadLetterRepository.findByBatchNo(batchNo)
                .orElseThrow(() -> BusinessException.of(404, "死信记录不存在"));
    }

    public Page<DeadLetter> queryDeadLetters(int pageNum, int pageSize, Boolean recovered) {
        Pageable pageable = PageRequest.of(
                pageNum - 1,
                pageSize,
                Sort.by(Sort.Direction.DESC, "deadLetterTime")
        );

        if (recovered != null) {
            return deadLetterRepository.findByRecovered(recovered, pageable);
        }

        return deadLetterRepository.findAll(pageable);
    }

    public long countUnrecovered() {
        return deadLetterRepository.countByRecovered(false);
    }

    public List<Object[]> getUnrecoveredByTaskType() {
        return deadLetterRepository.countUnrecoveredByTaskType();
    }
}
