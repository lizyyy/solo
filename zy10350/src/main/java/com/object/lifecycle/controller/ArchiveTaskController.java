package com.object.lifecycle.controller;

import com.object.lifecycle.dto.ApiResponse;
import com.object.lifecycle.dto.CreateArchiveTaskRequest;
import com.object.lifecycle.entity.ArchiveTask;
import com.object.lifecycle.entity.AuditLog;
import com.object.lifecycle.enums.TaskStatus;
import com.object.lifecycle.service.ArchiveTaskService;
import com.object.lifecycle.service.AuditLogService;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/archive-tasks")
@RequiredArgsConstructor
public class ArchiveTaskController {

    private final ArchiveTaskService taskService;
    private final AuditLogService auditLogService;

    @PostMapping
    public ApiResponse<ArchiveTask> createTask(@Valid @RequestBody CreateArchiveTaskRequest request) {
        ArchiveTask task = taskService.createTask(request);
        return ApiResponse.success("归档任务创建成功", task);
    }

    @GetMapping("/{taskId}")
    public ApiResponse<ArchiveTask> getTask(@PathVariable String taskId) {
        ArchiveTask task = taskService.getTaskByTaskId(taskId);
        return ApiResponse.success(task);
    }

    @GetMapping
    public ApiResponse<List<ArchiveTask>> getAllTasks(
            @RequestParam(required = false) TaskStatus status,
            @RequestParam(required = false) Long ruleId) {
        if (status != null) {
            return ApiResponse.success(taskService.getTasksByStatus(status));
        }
        if (ruleId != null) {
            return ApiResponse.success(taskService.getTasksByRuleId(ruleId));
        }
        return ApiResponse.success(taskService.getAllTasks());
    }

    @PostMapping("/{taskId}/start")
    public ApiResponse<ArchiveTask> startTask(@PathVariable String taskId) {
        ArchiveTask task = taskService.startTask(taskId);
        return ApiResponse.success("任务开始执行", task);
    }

    @PostMapping("/{taskId}/complete")
    public ApiResponse<ArchiveTask> completeTask(@PathVariable String taskId) {
        ArchiveTask task = taskService.completeTask(taskId);
        return ApiResponse.success("任务已完成", task);
    }

    @PostMapping("/{taskId}/fail")
    public ApiResponse<ArchiveTask> failTask(@PathVariable String taskId,
            @RequestParam(required = false) String errorMessage) {
        ArchiveTask task = taskService.failTask(taskId, errorMessage);
        return ApiResponse.success("任务已标记失败", task);
    }

    @PostMapping("/{taskId}/cancel")
    public ApiResponse<ArchiveTask> cancelTask(@PathVariable String taskId) {
        ArchiveTask task = taskService.cancelTask(taskId);
        return ApiResponse.success("任务已撤销", task);
    }

    @GetMapping("/{taskId}/audit-logs")
    public ApiResponse<List<AuditLog>> getAuditLogs(@PathVariable String taskId) {
        List<AuditLog> logs = auditLogService.getAuditLogs("ArchiveTask", taskId);
        return ApiResponse.success(logs);
    }
}
