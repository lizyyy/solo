package com.migration.dualwrite.controller;

import com.migration.dualwrite.dto.MigrationTask;
import com.migration.dualwrite.service.IdempotentService;
import com.migration.dualwrite.service.MigrationTaskService;
import com.migration.dualwrite.vo.request.CreateTaskRequest;
import com.migration.dualwrite.vo.request.SwitchRequest;
import com.migration.dualwrite.vo.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/migration")
@RequiredArgsConstructor
public class MigrationTaskController {

    private final MigrationTaskService migrationTaskService;
    private final IdempotentService idempotentService;

    @PostMapping("/tasks")
    public ApiResponse<MigrationTask> createTask(@Valid @RequestBody CreateTaskRequest request) {
        log.info("创建迁移任务: interfaceName={}", request.getInterfaceName());
        String idempotentKey = idempotentService.generateIdempotentKey(
                request.getInterfaceName(), request.getBusinessKey(), request.getWriteData());

        MigrationTask existingTask = idempotentService.getCachedResult(idempotentKey);
        if (existingTask != null) {
            log.info("幂等命中，返回已有任务: taskId={}", existingTask.getTaskId());
            return ApiResponse.successIdempotent(existingTask);
        }

        MigrationTask task = migrationTaskService.createTask(request);
        return ApiResponse.success("任务创建成功", task);
    }

    @PostMapping("/tasks/{taskId}/validate")
    public ApiResponse<MigrationTask> validateTask(@PathVariable String taskId) {
        log.info("校验任务: taskId={}", taskId);
        MigrationTask task = migrationTaskService.validateTask(taskId);
        return ApiResponse.success("任务校验通过", task);
    }

    @PostMapping("/tasks/{taskId}/dual-write")
    public ApiResponse<MigrationTask> executeDualWrite(@PathVariable String taskId) {
        log.info("执行双写: taskId={}", taskId);
        MigrationTask task = migrationTaskService.executeDualWrite(taskId);
        return ApiResponse.success("双写执行完成", task);
    }

    @PostMapping("/tasks/{taskId}/compare")
    public ApiResponse<MigrationTask> executeCompare(@PathVariable String taskId) {
        log.info("执行比对: taskId={}", taskId);
        MigrationTask task = migrationTaskService.executeCompare(taskId);
        return ApiResponse.success("比对完成", task);
    }

    @PostMapping("/tasks/{taskId}/conclusion")
    public ApiResponse<MigrationTask> generateSwitchConclusion(
            @PathVariable String taskId,
            @Valid @RequestBody SwitchRequest request) {
        log.info("生成切换结论: taskId={}", taskId);
        MigrationTask task = migrationTaskService.generateSwitchConclusion(taskId, request);
        return ApiResponse.success("切换结论生成完成", task);
    }

    @PostMapping("/tasks/{taskId}/switch")
    public ApiResponse<MigrationTask> executeSwitch(
            @PathVariable String taskId,
            @Valid @RequestBody SwitchRequest request) {
        log.info("执行切换: taskId={}", taskId);
        MigrationTask task = migrationTaskService.executeSwitch(taskId, request);
        return ApiResponse.success("切换执行完成", task);
    }

    @PostMapping("/tasks/{taskId}/rollback")
    public ApiResponse<MigrationTask> executeRollback(
            @PathVariable String taskId,
            @Valid @RequestBody SwitchRequest request) {
        log.info("执行回滚: taskId={}", taskId);
        MigrationTask task = migrationTaskService.executeRollback(taskId, request);
        return ApiResponse.success("回滚执行完成", task);
    }

    @PostMapping("/tasks/full-flow")
    public ApiResponse<MigrationTask> executeFullFlow(@Valid @RequestBody CreateTaskRequest request) {
        log.info("执行完整流程: interfaceName={}", request.getInterfaceName());
        String idempotentKey = idempotentService.generateIdempotentKey(
                request.getInterfaceName(), request.getBusinessKey(), request.getWriteData());

        MigrationTask existingTask = idempotentService.getCachedResult(idempotentKey);
        if (existingTask != null) {
            log.info("幂等命中，返回已有任务结果: taskId={}", existingTask.getTaskId());
            return ApiResponse.successIdempotent(existingTask);
        }

        MigrationTask task = migrationTaskService.executeFullFlow(request);
        return ApiResponse.success("完整流程执行完成", task);
    }

    @GetMapping("/tasks/{taskId}")
    public ApiResponse<MigrationTask> getTask(@PathVariable String taskId) {
        log.info("查询任务详情: taskId={}", taskId);
        MigrationTask task = migrationTaskService.getTask(taskId);
        return ApiResponse.success(task);
    }

    @GetMapping("/tasks")
    public ApiResponse<List<MigrationTask>> getAllTasks() {
        log.info("查询所有任务");
        List<MigrationTask> tasks = migrationTaskService.getAllTasks();
        return ApiResponse.success(tasks);
    }

    @GetMapping("/tasks/interface/{interfaceName}")
    public ApiResponse<List<MigrationTask>> getTasksByInterfaceName(@PathVariable String interfaceName) {
        log.info("按接口名查询任务: interfaceName={}", interfaceName);
        List<MigrationTask> tasks = migrationTaskService.getTasksByInterfaceName(interfaceName);
        return ApiResponse.success(tasks);
    }

    @DeleteMapping("/cache")
    public ApiResponse<Void> clearCache() {
        log.info("清空缓存");
        idempotentService.clearCache();
        return ApiResponse.success("缓存已清空", null);
    }
}
