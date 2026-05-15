package com.object.lifecycle.service;

import com.object.lifecycle.dto.CreateArchiveTaskRequest;
import com.object.lifecycle.entity.ArchiveTask;
import com.object.lifecycle.entity.LifecycleRule;
import com.object.lifecycle.enums.TaskStatus;
import com.object.lifecycle.exception.BusinessException;
import com.object.lifecycle.repository.ArchiveTaskRepository;
import com.object.lifecycle.repository.LifecycleRuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ArchiveTaskService {

    private final ArchiveTaskRepository taskRepository;
    private final LifecycleRuleRepository ruleRepository;
    private final AuditLogService auditLogService;
    private final ExecutionProofService proofService;

    @Transactional
    public ArchiveTask createTask(CreateArchiveTaskRequest request) {
        if (taskRepository.findByTaskId(request.getTaskId()).isPresent()) {
            throw new BusinessException(400, "任务ID已存在: " + request.getTaskId());
        }

        LifecycleRule rule = ruleRepository.findById(request.getRuleId())
                .orElseThrow(() -> new BusinessException(404, "规则不存在"));

        if (taskRepository.existsByRuleIdAndObjectKeyAndBucketName(
                request.getRuleId(), request.getObjectKey(), request.getBucketName())) {
            throw new BusinessException(400, "该规则下已存在相同对象的归档任务");
        }

        ArchiveTask task = new ArchiveTask();
        task.setTaskId(request.getTaskId());
        task.setRule(rule);
        task.setObjectKey(request.getObjectKey());
        task.setBucketName(request.getBucketName());
        task.setObjectSize(request.getObjectSize());
        task.setSourceStorageClass(request.getSourceStorageClass());
        task.setTargetStorageClass(request.getTargetStorageClass());
        task.setStatus(TaskStatus.PENDING);
        task.setScheduledTime(LocalDateTime.now());

        ArchiveTask saved = taskRepository.save(task);
        auditLogService.logAction("ArchiveTask", saved.getTaskId(), "CREATE", null, null);
        proofService.createProof("CREATE_ARCHIVE_TASK", rule.getRuleId(), saved.getTaskId(),
                saved.getObjectKey(), saved.getBucketName(), true, null, null);
        log.info("创建归档任务: taskId={}, ruleId={}", saved.getTaskId(), rule.getRuleId());
        return saved;
    }

    public ArchiveTask getTaskByTaskId(String taskId) {
        return taskRepository.findByTaskId(taskId)
                .orElseThrow(() -> new BusinessException(404, "归档任务不存在"));
    }

    public List<ArchiveTask> getAllTasks() {
        return taskRepository.findAll();
    }

    public List<ArchiveTask> getTasksByStatus(TaskStatus status) {
        return taskRepository.findByStatus(status);
    }

    public List<ArchiveTask> getTasksByRuleId(Long ruleId) {
        return taskRepository.findByRuleId(ruleId);
    }

    @Transactional
    public ArchiveTask startTask(String taskId) {
        ArchiveTask task = getTaskByTaskId(taskId);
        if (task.getStatus() != TaskStatus.PENDING && task.getStatus() != TaskStatus.SCHEDULED) {
            throw new BusinessException(400, "只有待处理或已调度状态的任务才能开始执行");
        }

        TaskStatus oldStatus = task.getStatus();
        task.setStatus(TaskStatus.RUNNING);
        task.setStartTime(LocalDateTime.now());
        ArchiveTask saved = taskRepository.save(task);
        auditLogService.logAction("ArchiveTask", saved.getTaskId(), "START",
                "status", oldStatus.name(), TaskStatus.RUNNING.name());
        log.info("开始归档任务: taskId={}", taskId);
        return saved;
    }

    @Transactional
    public ArchiveTask completeTask(String taskId) {
        ArchiveTask task = getTaskByTaskId(taskId);
        if (task.getStatus() != TaskStatus.RUNNING) {
            throw new BusinessException(400, "只有运行中状态的任务才能完成");
        }

        TaskStatus oldStatus = task.getStatus();
        task.setStatus(TaskStatus.COMPLETED);
        task.setCompletedTime(LocalDateTime.now());
        ArchiveTask saved = taskRepository.save(task);
        auditLogService.logAction("ArchiveTask", saved.getTaskId(), "COMPLETE",
                "status", oldStatus.name(), TaskStatus.COMPLETED.name());
        proofService.createProof("COMPLETE_ARCHIVE_TASK", saved.getRule().getRuleId(), saved.getTaskId(),
                saved.getObjectKey(), saved.getBucketName(), true, "归档完成", null);
        log.info("完成归档任务: taskId={}", taskId);
        return saved;
    }

    @Transactional
    public ArchiveTask failTask(String taskId, String errorMessage) {
        ArchiveTask task = getTaskByTaskId(taskId);
        if (task.getStatus() != TaskStatus.RUNNING) {
            throw new BusinessException(400, "只有运行中状态的任务才能标记失败");
        }

        TaskStatus oldStatus = task.getStatus();
        task.setStatus(TaskStatus.FAILED);
        task.setErrorMessage(errorMessage);
        task.setRetryCount(task.getRetryCount() + 1);
        ArchiveTask saved = taskRepository.save(task);
        auditLogService.logAction("ArchiveTask", saved.getTaskId(), "FAIL",
                "status", oldStatus.name(), TaskStatus.FAILED.name());
        proofService.createProof("FAIL_ARCHIVE_TASK", saved.getRule().getRuleId(), saved.getTaskId(),
                saved.getObjectKey(), saved.getBucketName(), false, null, errorMessage);
        log.warn("归档任务失败: taskId={}, error={}", taskId, errorMessage);
        return saved;
    }

    @Transactional
    public ArchiveTask cancelTask(String taskId) {
        ArchiveTask task = getTaskByTaskId(taskId);
        if (task.getStatus() == TaskStatus.COMPLETED || task.getStatus() == TaskStatus.FAILED) {
            throw new BusinessException(400, "已完成或已失败的任务不能撤销");
        }

        TaskStatus oldStatus = task.getStatus();
        task.setStatus(TaskStatus.CANCELLED);
        ArchiveTask saved = taskRepository.save(task);
        auditLogService.logAction("ArchiveTask", saved.getTaskId(), "CANCEL",
                "status", oldStatus.name(), TaskStatus.CANCELLED.name());
        log.info("撤销归档任务: taskId={}", taskId);
        return saved;
    }
}
