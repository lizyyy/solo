package com.resource.tag.controller;

import com.resource.tag.dto.*;
import com.resource.tag.model.*;
import com.resource.tag.service.TagInheritanceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/v1/tag-inheritance")
@RequiredArgsConstructor
public class TagInheritanceController {

    private final TagInheritanceService inheritanceService;

    @PostMapping("/tasks")
    public ApiResponse<TaskStatusResponse> createTask(@Valid @RequestBody CreateTaskRequest request) {
        log.info("Received create task request: {}", request.getRequestId());
        return inheritanceService.createTask(request);
    }

    @PostMapping("/tasks/{taskId}/validate")
    public ApiResponse<TaskStatusResponse> validateTask(@PathVariable String taskId) {
        log.info("Validating task: {}", taskId);
        return inheritanceService.validateTask(taskId);
    }

    @PostMapping("/tasks/{taskId}/calculate")
    public ApiResponse<TaskStatusResponse> calculateInheritance(@PathVariable String taskId) {
        log.info("Calculating inheritance for task: {}", taskId);
        return inheritanceService.calculateInheritance(taskId);
    }

    @GetMapping("/tasks/{taskId}/status")
    public ApiResponse<TaskStatusResponse> getTaskStatus(@PathVariable String taskId) {
        return inheritanceService.getTaskStatus(taskId);
    }

    @GetMapping("/tasks/{taskId}/conflicts")
    public ApiResponse<List<ConflictItem>> getTaskConflicts(@PathVariable String taskId) {
        return inheritanceService.getTaskConflicts(taskId);
    }

    @PostMapping("/tasks/{taskId}/conflicts/{conflictId}/resolve")
    public ApiResponse<TaskStatusResponse> resolveConflict(
            @PathVariable String taskId,
            @PathVariable Long conflictId,
            @Valid @RequestBody ConflictResolutionRequest request) {
        log.info("Resolving conflict {} for task: {}", conflictId, taskId);
        return inheritanceService.resolveConflict(taskId, conflictId, request);
    }

    @GetMapping("/tasks/{taskId}/results")
    public ApiResponse<List<CalculationResult>> getTaskResults(@PathVariable String taskId) {
        return inheritanceService.getTaskResults(taskId);
    }

    @GetMapping("/tasks/{taskId}/history")
    public ApiResponse<List<ChangeHistory>> getTaskHistory(@PathVariable String taskId) {
        return inheritanceService.getTaskHistory(taskId);
    }

    @GetMapping("/tasks/{taskId}/history/export")
    public ApiResponse<List<ChangeHistory>> exportHistory(@PathVariable String taskId) {
        return inheritanceService.exportHistory(taskId);
    }
}
