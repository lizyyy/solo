package com.migration.dualwrite.service;

import com.migration.dualwrite.constant.ErrorCode;
import com.migration.dualwrite.dto.*;
import com.migration.dualwrite.enums.TaskStatus;
import com.migration.dualwrite.exception.BusinessException;
import com.migration.dualwrite.vo.request.CreateTaskRequest;
import com.migration.dualwrite.vo.request.SwitchRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class MigrationTaskService {

    private final TaskStorageService taskStorageService;
    private final DualWriteService dualWriteService;
    private final CompareService compareService;
    private final IdempotentService idempotentService;

    public MigrationTask createTask(CreateTaskRequest request) {
        String idempotentKey = idempotentService.generateIdempotentKey(request.getInterfaceName(),
                request.getBusinessKey(), request.getWriteData());

        MigrationTask cachedTask = idempotentService.getCachedResult(idempotentKey);
        if (cachedTask != null) {
            log.info("幂等命中: idempotentKey={}, taskId={}", idempotentKey, cachedTask.getTaskId());
            return cachedTask;
        }

        MigrationTask task = new MigrationTask();
        task.setTaskId(UUID.randomUUID().toString());
        task.setInterfaceName(request.getInterfaceName());
        task.setBusinessKey(request.getBusinessKey());
        task.setCreatedBy(request.getCreatedBy());
        task.setRemark(request.getRemark());
        task.setStatus(TaskStatus.CREATED);
        task.setStatusDesc(TaskStatus.CREATED.getDesc());
        task.setCreatedAt(LocalDateTime.now());
        task.setUpdatedAt(LocalDateTime.now());

        task.setOldDataSource(request.getOldDataSource());
        task.setNewDataSource(request.getNewDataSource());
        task.setFields(request.getFields());
        task.setWriteData(request.getWriteData());

        taskStorageService.saveTask(task);
        idempotentService.cacheResult(idempotentKey, task);

        log.info("任务创建成功: taskId={}, interfaceName={}", task.getTaskId(), task.getInterfaceName());
        return task;
    }

    public MigrationTask validateTask(String taskId) {
        MigrationTask task = taskStorageService.getTask(taskId);
        checkStatusTransition(task, TaskStatus.CREATED, TaskStatus.VALIDATING);

        task.setStatus(TaskStatus.VALIDATING);
        task.setStatusDesc(TaskStatus.VALIDATING.getDesc());
        task.setUpdatedAt(LocalDateTime.now());
        taskStorageService.saveTask(task);

        try {
            List<String> errors = validateConfig(task);

            if (!errors.isEmpty()) {
                task.setStatus(TaskStatus.FAILED);
                task.setStatusDesc(TaskStatus.FAILED.getDesc());
                task.setErrorCode(ErrorCode.VALIDATION_FAILED);
                task.setErrorMessage("配置校验失败");
                task.setErrorDetails(errors);
                taskStorageService.saveTask(task);
                throw new BusinessException(ErrorCode.VALIDATION_FAILED, "配置校验失败", errors);
            }

            task.setStatus(TaskStatus.VALIDATED);
            task.setStatusDesc(TaskStatus.VALIDATED.getDesc());
            taskStorageService.saveTask(task);

            log.info("任务校验通过: taskId={}", taskId);
            return task;

        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            task.setStatus(TaskStatus.FAILED);
            task.setStatusDesc(TaskStatus.FAILED.getDesc());
            task.setErrorCode("VALIDATE_ERROR");
            task.setErrorMessage(e.getMessage());
            taskStorageService.saveTask(task);
            throw e;
        }
    }

    public MigrationTask executeDualWrite(String taskId) {
        MigrationTask task = taskStorageService.getTask(taskId);
        checkStatusTransition(task, TaskStatus.VALIDATED, TaskStatus.DUAL_WRITING);

        task.setStatus(TaskStatus.DUAL_WRITING);
        task.setStatusDesc(TaskStatus.DUAL_WRITING.getDesc());
        task.setUpdatedAt(LocalDateTime.now());
        taskStorageService.saveTask(task);

        try {
            WriteResult oldWriteResult = dualWriteService.executeWrite(task, true);
            task.setOldWriteResult(oldWriteResult);

            if (!oldWriteResult.getSuccess()) {
                task.setStatus(TaskStatus.FAILED);
                task.setStatusDesc(TaskStatus.FAILED.getDesc());
                task.setErrorCode(ErrorCode.OLD_WRITE_FAILED);
                task.setErrorMessage("旧库写入失败: " + oldWriteResult.getErrorMessage());
                taskStorageService.saveTask(task);
                throw new BusinessException(ErrorCode.OLD_WRITE_FAILED,
                        "旧库写入失败: " + oldWriteResult.getErrorMessage());
            }

            WriteResult newWriteResult = dualWriteService.executeWrite(task, false);
            task.setNewWriteResult(newWriteResult);

            if (!newWriteResult.getSuccess()) {
                task.setStatus(TaskStatus.FAILED);
                task.setStatusDesc(TaskStatus.FAILED.getDesc());
                task.setErrorCode(ErrorCode.NEW_WRITE_FAILED);
                task.setErrorMessage("新库写入失败: " + newWriteResult.getErrorMessage());
                taskStorageService.saveTask(task);
                throw new BusinessException(ErrorCode.NEW_WRITE_FAILED,
                        "新库写入失败: " + newWriteResult.getErrorMessage());
            }

            task.setStatus(TaskStatus.DUAL_WRITE_COMPLETED);
            task.setStatusDesc(TaskStatus.DUAL_WRITE_COMPLETED.getDesc());
            taskStorageService.saveTask(task);

            log.info("双写执行完成: taskId={}", taskId);
            return task;

        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            task.setStatus(TaskStatus.FAILED);
            task.setStatusDesc(TaskStatus.FAILED.getDesc());
            task.setErrorCode("DUAL_WRITE_ERROR");
            task.setErrorMessage(e.getMessage());
            taskStorageService.saveTask(task);
            throw e;
        }
    }

    public MigrationTask executeCompare(String taskId) {
        MigrationTask task = taskStorageService.getTask(taskId);
        checkStatusTransition(task, TaskStatus.DUAL_WRITE_COMPLETED, TaskStatus.COMPARING);

        task.setStatus(TaskStatus.COMPARING);
        task.setStatusDesc(TaskStatus.COMPARING.getDesc());
        task.setUpdatedAt(LocalDateTime.now());
        taskStorageService.saveTask(task);

        try {
            List<FieldDiff> diffs = compareService.compareResults(task);

            task.setDiffs(diffs);
            task.setDiffCount(diffs.size());
            task.setDiffPassed(diffs.isEmpty());

            if (diffs.isEmpty()) {
                task.setStatus(TaskStatus.SWITCH_READY);
                task.setStatusDesc(TaskStatus.SWITCH_READY.getDesc());
                log.info("比对完成，无差异，可切换: taskId={}", taskId);
            } else {
                task.setStatus(TaskStatus.COMPARE_COMPLETED);
                task.setStatusDesc(TaskStatus.COMPARE_COMPLETED.getDesc());
                log.info("比对完成，存在 {} 处差异: taskId={}", diffs.size(), taskId);
            }

            taskStorageService.saveTask(task);
            return task;

        } catch (Exception e) {
            task.setStatus(TaskStatus.FAILED);
            task.setStatusDesc(TaskStatus.FAILED.getDesc());
            task.setErrorCode(ErrorCode.COMPARE_FAILED);
            task.setErrorMessage(e.getMessage());
            taskStorageService.saveTask(task);
            throw e;
        }
    }

    public MigrationTask generateSwitchConclusion(String taskId, SwitchRequest request) {
        MigrationTask task = taskStorageService.getTask(taskId);

        if (task.getStatus() != TaskStatus.SWITCH_READY &&
                task.getStatus() != TaskStatus.COMPARE_COMPLETED) {
            throw new BusinessException(ErrorCode.INVALID_STATUS_TRANSITION,
                    "当前状态不允许生成切换结论: " + task.getStatus().getDesc());
        }

        SwitchConclusion conclusion = new SwitchConclusion();
        conclusion.setConclusionTime(LocalDateTime.now());
        conclusion.setApprovedBy(request.getApprovedBy());

        List<String> conditions = new ArrayList<>();
        List<String> blockingIssues = new ArrayList<>();

        if (task.getDiffCount() != null && task.getDiffCount() > 0) {
            blockingIssues.add("存在 " + task.getDiffCount() + " 处数据差异");
        } else {
            conditions.add("数据比对无差异");
        }

        if (task.getOldWriteResult() != null && task.getOldWriteResult().getSuccess()) {
            conditions.add("旧库写入成功");
        } else {
            blockingIssues.add("旧库写入失败");
        }

        if (task.getNewWriteResult() != null && task.getNewWriteResult().getSuccess()) {
            conditions.add("新库写入成功");
        } else {
            blockingIssues.add("新库写入失败");
        }

        conclusion.setSwitchConditions(conditions);
        conclusion.setBlockingIssues(blockingIssues);
        conclusion.setSwitchAllowed(blockingIssues.isEmpty());
        conclusion.setRiskLevel(blockingIssues.isEmpty() ? "LOW" : "HIGH");
        conclusion.setConclusion(blockingIssues.isEmpty() ? "允许切换" : "不允许切换，需先解决阻塞问题");
        conclusion.setRollbackPlan("如遇问题，执行回滚: 1.停止新库流量 2.恢复旧库配置 3.验证旧库功能");

        task.setSwitchConclusion(conclusion);
        task.setUpdatedAt(LocalDateTime.now());
        taskStorageService.saveTask(task);

        log.info("切换结论生成完成: taskId={}, switchAllowed={}", taskId, conclusion.getSwitchAllowed());
        return task;
    }

    public MigrationTask executeSwitch(String taskId, SwitchRequest request) {
        MigrationTask task = taskStorageService.getTask(taskId);

        if (task.getSwitchConclusion() == null || !task.getSwitchConclusion().getSwitchAllowed()) {
            throw new BusinessException(ErrorCode.SWITCH_NOT_ALLOWED,
                    "切换未被允许，请先生成切换结论并确保无阻塞问题");
        }

        task.setStatus(TaskStatus.SWITCHED);
        task.setStatusDesc(TaskStatus.SWITCHED.getDesc());
        task.setUpdatedAt(LocalDateTime.now());
        taskStorageService.saveTask(task);

        log.info("切换执行完成: taskId={}, operator={}", taskId, request.getOperator());
        return task;
    }

    public MigrationTask executeRollback(String taskId, SwitchRequest request) {
        MigrationTask task = taskStorageService.getTask(taskId);

        if (task.getStatus() != TaskStatus.SWITCHED) {
            throw new BusinessException(ErrorCode.ROLLBACK_NOT_ALLOWED,
                    "只有已切换状态才能回滚，当前状态: " + task.getStatus().getDesc());
        }

        RollbackRecord rollbackRecord = new RollbackRecord();
        rollbackRecord.setRollbackId(UUID.randomUUID().toString());
        rollbackRecord.setRollbackTime(LocalDateTime.now());
        rollbackRecord.setOperator(request.getOperator());
        rollbackRecord.setRollbackReason(request.getRemark());
        rollbackRecord.setRollbackSteps(List.of(
                "停止新库流量",
                "恢复旧库配置",
                "验证旧库功能",
                "确认回滚完成"
        ));
        rollbackRecord.setRollbackSuccess(true);
        rollbackRecord.setRollbackResult("回滚成功，流量已切回旧库");

        task.setRollbackRecord(rollbackRecord);
        task.setStatus(TaskStatus.ROLLBACKED);
        task.setStatusDesc(TaskStatus.ROLLBACKED.getDesc());
        task.setUpdatedAt(LocalDateTime.now());
        taskStorageService.saveTask(task);

        log.info("回滚执行完成: taskId={}, rollbackId={}", taskId, rollbackRecord.getRollbackId());
        return task;
    }

    public MigrationTask getTask(String taskId) {
        return taskStorageService.getTask(taskId);
    }

    public List<MigrationTask> getAllTasks() {
        return taskStorageService.getAllTasks();
    }

    public List<MigrationTask> getTasksByInterfaceName(String interfaceName) {
        return taskStorageService.getTasksByInterfaceName(interfaceName);
    }

    public MigrationTask executeFullFlow(CreateTaskRequest request) {
        MigrationTask task = createTask(request);
        task = validateTask(task.getTaskId());
        task = executeDualWrite(task.getTaskId());
        task = executeCompare(task.getTaskId());
        return task;
    }

    private List<String> validateConfig(MigrationTask task) {
        List<String> errors = new ArrayList<>();

        if (task.getOldDataSource() == null) {
            errors.add("旧数据源配置不能为空");
        }
        if (task.getNewDataSource() == null) {
            errors.add("新数据源配置不能为空");
        }
        if (task.getFields() == null || task.getFields().isEmpty()) {
            errors.add("比对字段不能为空");
        }
        if (task.getWriteData() == null || task.getWriteData().isEmpty()) {
            errors.add("写入数据不能为空");
        }

        boolean hasPrimaryKey = task.getFields() != null &&
                task.getFields().stream().anyMatch(MigrationField::isPrimaryKey);
        if (!hasPrimaryKey) {
            errors.add("必须指定至少一个主键字段");
        }

        return errors;
    }

    private void checkStatusTransition(MigrationTask task, TaskStatus expected, TaskStatus next) {
        if (task.getStatus() != expected) {
            throw new BusinessException(ErrorCode.INVALID_STATUS_TRANSITION,
                    String.format("状态不匹配，期望: %s, 当前: %s, 无法进入: %s",
                            expected.getDesc(), task.getStatus().getDesc(), next.getDesc()));
        }
    }
}
